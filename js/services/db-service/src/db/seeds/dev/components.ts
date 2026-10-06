import * as schema from '../../schema';

export async function seedComponents(db: any) {
  const rows = await db
    .insert(schema.components)
    .values([
      { name: 'Button', platform: 'web', description: 'Компонент кнопка.' },
      { name: 'Text', platform: 'web', description: 'Компонент текст.' },
      { name: 'Link', platform: 'web', description: 'Компонент ссылка.' },
      { name: 'TextField', platform: 'web', description: 'Компонент поле для ввода.' },
      { name: 'Cell', platform: 'web', description: 'Компонент ячейка.' },
      { name: 'CellLabel', platform: 'web', description: 'Лейбл ячейки.' },
      { name: 'CellTitle', platform: 'web', description: 'Заголовок ячейки.' },
    ])
    .returning();

  const button = rows.find((r: any) => r.name === 'Button')!;
  const text = rows.find((r: any) => r.name === 'Text')!;
  const link = rows.find((r: any) => r.name === 'Link')!;
  const textField = rows.find((r: any) => r.name === 'TextField')!;
  const cell = rows.find((r: any) => r.name === 'Cell')!;
  const cellLabel = rows.find((r: any) => r.name === 'CellLabel')!;
  const cellTitle = rows.find((r: any) => r.name === 'CellTitle')!;

  console.log(
    `  components: button(${button.id}), text(${text.id}), link(${link.id}), textField(${textField.id}), cell(${cell.id}), cellLabel(${cellLabel.id}), cellTitle(${cellTitle.id})`,
  );
  return { button, text, link, textField, cell, cellLabel, cellTitle };
}
