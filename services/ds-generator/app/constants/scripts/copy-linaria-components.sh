#!/usr/bin/env bash

# Example: Calendar
components=$(grep -R plasma-new-hope src/components | cut -d / -f 3 | sort -u)

mkdir -p src-css/components/

cp -R src/theme src-css/theme

# Создание и добавление строки экспорта темы
echo "export * from './theme';" > src-css/index.ts
echo "export * from './theme';" > src-css/index.d.ts

for component in $components; do
    cp -R src/components/$component src-css/components/;
    grep -E "\<$component\>" src/index.ts >> src-css/index.ts
    echo "export * from '../components/$component';" >> src-css/index.d.ts;
    
done;

# plasma-new-hope/styled-components
files=$(find src-css/components -name '*.ts' -or -name '*.tsx');

for file in $files; do
    echo $file;
done;

# plasma-new-hope/styled-components => plasma-new-hope
perl -p -i -e "s/\/styled-components//g" $files
