-- Роли осей хранятся на appearance: корневая ось и ось цветовой схемы.
ALTER TABLE appearances
    ADD COLUMN root_variation_id uuid,
    ADD COLUMN color_scheme_variation_id uuid;

-- Роль цветовой схемы переносится из флага. Если флагов несколько, берётся ось с наименьшей позицией.
UPDATE appearances a
SET color_scheme_variation_id = flagged.variation_id
FROM (
    SELECT DISTINCT ON (appearance_id) appearance_id, variation_id
    FROM appearance_variations
    WHERE is_color_scheme
    ORDER BY appearance_id, position
) flagged
WHERE flagged.appearance_id = a.id;

-- Флаг остаётся истинным только у оси, на которую указывает appearance.
UPDATE appearance_variations av
SET is_color_scheme = false
WHERE av.is_color_scheme
  AND NOT EXISTS (
      SELECT 1
      FROM appearances a
      WHERE a.id = av.appearance_id
        AND a.color_scheme_variation_id = av.variation_id
  );

-- Корень: среди осей, кроме оси цветовой схемы, ось с именем size, иначе первая по позиции.
UPDATE appearances a
SET root_variation_id = candidate.variation_id
FROM (
    SELECT DISTINCT ON (av.appearance_id) av.appearance_id, av.variation_id
    FROM appearance_variations av
    JOIN variations v ON v.id = av.variation_id
    JOIN appearances ap ON ap.id = av.appearance_id
    WHERE av.variation_id IS DISTINCT FROM ap.color_scheme_variation_id
    ORDER BY av.appearance_id, (v.name = 'size') DESC, av.position
) candidate
WHERE candidate.appearance_id = a.id;

-- Роль указывает на ось этого же appearance; опора для ссылки — уникальный индекс av_appearance_variation_unique.
-- Удаление оси снимает только колонку роли, но не идентификатор appearance.
ALTER TABLE appearances
    ADD CONSTRAINT appearances_root_variation_fk
        FOREIGN KEY (id, root_variation_id)
        REFERENCES appearance_variations (appearance_id, variation_id)
        ON DELETE SET NULL (root_variation_id),
    ADD CONSTRAINT appearances_color_scheme_variation_fk
        FOREIGN KEY (id, color_scheme_variation_id)
        REFERENCES appearance_variations (appearance_id, variation_id)
        ON DELETE SET NULL (color_scheme_variation_id);
