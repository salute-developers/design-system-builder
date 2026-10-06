-- Разведка данных перед миграцией 0007. Только чтение; запускать на целевой базе (dev, stage, prod).
-- psql -U postgres -d ds_registry -f audit.sql

\echo '== размеры'
select 'components', count(*) from components
union all select 'properties', count(*) from properties
union all select 'properties platform=' || coalesce(platform::text, 'NULL'), count(*) from properties group by platform
union all select 'aliases ' || platform, count(*) from property_platform_params group by platform
union all select 'variations', count(*) from variations
union all select 'states (component)', count(*) from states where component_id is not null
union all select 'appearances platform=' || coalesce(platform::text, 'NULL'), count(*) from appearances group by platform
union all select 'design_system_components', count(*) from design_system_components
union all select 'invariant values', count(*) from invariant_property_values
union all select 'variation values', count(*) from variation_property_values
union all select 'style combinations', count(*) from style_combinations;

\echo '== платформы компонентов по признакам (алиасы, web-свойства, web-appearance)'
with ev as (
  select c.id,
    array_to_string(array_remove(array[
      case when exists (select 1 from property_platform_params pp join properties p on p.id = pp.property_id where p.component_id = c.id and pp.platform = 'compose') then 'compose' end,
      case when exists (select 1 from property_platform_params pp join properties p on p.id = pp.property_id where p.component_id = c.id and pp.platform = 'xml') then 'xml' end,
      case when exists (select 1 from property_platform_params pp join properties p on p.id = pp.property_id where p.component_id = c.id and pp.platform = 'ios') then 'ios' end,
      case when exists (select 1 from property_platform_params pp join properties p on p.id = pp.property_id where p.component_id = c.id and pp.platform = 'web')
             or exists (select 1 from properties p where p.component_id = c.id and p.platform = 'web')
             or exists (select 1 from appearances a where a.component_id = c.id and a.platform = 'web') then 'web' end
    ], null), '+') as combo
  from components c)
select combo, count(*) from ev group by 1 order by 2 desc;

\echo '== свойства: платформа свойства и платформы алиасов'
with pe as (
  select p.id, p.platform pplat,
    coalesce((select string_agg(distinct pp.platform::text, '+' order by pp.platform::text) from property_platform_params pp where pp.property_id = p.id), '-') aliases
  from properties p)
select coalesce(pplat::text, 'NULL') as property_platform, aliases, count(*) from pe group by 1, 2 order by 3 desc;

\echo '== значения конфигов по свойствам с нативными алиасами (должны остаться на web)'
with pe as (
  select p.id, p.platform pplat,
    coalesce((select string_agg(distinct pp.platform::text, '+' order by pp.platform::text) from property_platform_params pp where pp.property_id = p.id), '-') aliases
  from properties p)
select 'variation values', coalesce(pplat::text, 'NULL'), aliases, count(*) from variation_property_values v join pe on pe.id = v.property_id group by 2, 3
union all select 'invariant values', coalesce(pplat::text, 'NULL'), aliases, count(*) from invariant_property_values v join pe on pe.id = v.property_id group by 2, 3
order by 1, 4 desc;

\echo '== appearances без платформы (нативные конфиги): их надо разметить миграцией'
select count(*) as null_platform_appearances from appearances where platform is null;

\echo '== привязки дизайн-систем: платформы по признакам компонента'
select ds.name, count(*) as links,
       count(*) filter (where exists (select 1 from appearances a where a.design_system_id = ds.id and a.component_id = d.component_id)) as with_appearance
from design_system_components d join design_systems ds on ds.id = d.design_system_id group by ds.name;
