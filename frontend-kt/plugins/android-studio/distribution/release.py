#!/usr/bin/env python3
"""Проверяет ZIP IDEA-плагина и публикует новый неизменяемый GitHub Release."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile


def version(tag):
    match = re.fullmatch(r"idea-plugin-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", tag)
    if not match:
        raise ValueError("Ожидается тег idea-plugin-vMAJOR.MINOR.PATCH")
    return tag.removeprefix("idea-plugin-v")


def validate_plugin(archive, expected_version):
    with zipfile.ZipFile(archive) as plugin:
        descriptors = []
        for name in plugin.namelist():
            if name.endswith(".jar") and "/lib/" in name:
                import io

                with zipfile.ZipFile(io.BytesIO(plugin.read(name))) as library:
                    if "META-INF/plugin.xml" in library.namelist():
                        descriptor = ET.fromstring(library.read("META-INF/plugin.xml"))
                        if descriptor.findtext("id") == "com.dsbuilder.frontend.plugin.androidstudio":
                            descriptors.append(descriptor)
        if len(descriptors) != 1 or descriptors[0].findtext("version") != expected_version:
            raise ValueError("Версия или идентификатор плагина в ZIP не соответствуют релизному тегу")


def package(tag, directory, output):
    release_version = version(tag)
    archives = list(directory.glob("*.zip"))
    if len(archives) != 1:
        raise ValueError("В каталоге сборки должен находиться ровно один ZIP плагина")
    validate_plugin(archives[0], release_version)
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"dsbuilder-ide-plugin-{release_version}.zip"
    shutil.copyfile(archives[0], target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (output / "SHA256SUMS").write_text(f"{digest}  {target.name}\n")


def gh(*args):
    return subprocess.run(["gh", *args], text=True, capture_output=True)


def find_release(tag, repository):
    # The tag endpoint returns only published releases; list also includes our drafts.
    result = gh("api", "--paginate", f"repos/{repository}/releases?per_page=100",
                "--jq", f".[] | select(.tag_name == {json.dumps(tag)}) | .id")
    if result.returncode:
        raise ValueError("Не удалось проверить существование выпуска")
    ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(ids) > 1 or any(not value.isascii() or not value.isdecimal() for value in ids):
        raise ValueError("GitHub вернул неоднозначный идентификатор выпуска")
    return ids[0] if ids else None


def publish(tag, directory, repository):
    release_version = version(tag)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Некорректное имя репозитория")
    archive = directory / f"dsbuilder-ide-plugin-{release_version}.zip"
    sums = directory / "SHA256SUMS"
    validate_plugin(archive, release_version)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if sums.read_text() != f"{digest}  {archive.name}\n":
        raise ValueError("Контрольная сумма ZIP не совпадает с SHA256SUMS")
    if find_release(tag, repository) is not None:
        raise ValueError("Выпуск уже существует; его файлы не изменены. Используйте новый тег")
    notes = (
        "Установка: скачайте ZIP и SHA256SUMS, проверьте сумму командой "
        "`shasum -a 256 -c SHA256SUMS` (Windows: `Get-FileHash <архив> -Algorithm SHA256`), "
        "затем Settings → Plugins → Install Plugin from Disk. Поддерживаются IDE 243.* "
        "(sinceBuild=243, untilBuild=243.*). Превью требует JBR с JCEF; просмотр и копирование "
        "доступны и без него."
    )
    created = gh("release", "create", tag, str(archive), str(sums), "--repo", repository,
                 "--verify-tag", "--draft", "--title", f"DS Builder IDE Plugin {release_version}", "--notes", notes)
    if created.returncode:
        raise ValueError("Не удалось создать черновик выпуска: " + created.stderr)
    release_id = find_release(tag, repository)
    if release_id is None:
        raise ValueError("GitHub не вернул созданный черновик; выпуск не опубликован")
    remote = gh("api", f"repos/{repository}/releases/{release_id}")
    if remote.returncode:
        raise ValueError("Не удалось проверить файлы черновика; выпуск не опубликован")
    assets = {item["name"]: item for item in json.loads(remote.stdout).get("assets", [])}
    for file in (archive, sums):
        asset = assets.get(file.name, {})
        expected = "sha256:" + hashlib.sha256(file.read_bytes()).hexdigest()
        if asset.get("size") != file.stat().st_size or asset.get("digest") != expected:
            raise ValueError("Контрольная сумма файла на GitHub не совпадает; черновик не опубликован")
    promoted = gh("api", "--method", "PATCH", f"repos/{repository}/releases/{release_id}",
                  "-F", "draft=false", "-f", "make_latest=false")
    if promoted.returncode:
        raise ValueError("Не удалось опубликовать проверенный черновик")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["version", "package", "publish"])
    parser.add_argument("--tag", required=True)
    parser.add_argument("--directory", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", ""))
    args = parser.parse_args()
    if args.command == "version":
        print(version(args.tag))
    elif args.command == "package":
        if args.directory is None or args.output is None:
            parser.error("package требует --directory и --output")
        package(args.tag, args.directory, args.output)
    else:
        if args.directory is None:
            parser.error("publish требует --directory")
        publish(args.tag, args.directory, args.repository)


if __name__ == "__main__":
    main()
