import * as schema from '../../schema';

export async function seedComponents(db: any) {
  const rows = await db
    .insert(schema.components)
    .values([
      { name: 'Button', description: 'Компонент кнопка.' },
      { name: 'Text', description: 'Компонент текст.' },
      { name: 'Link', description: 'Компонент ссылка.' },
      { name: 'TextField', description: 'Компонент поле для ввода.' },
      { name: 'Cell', description: 'Компонент ячейка.' },
      { name: 'CellLabel', description: 'Лейбл ячейки.' },
      { name: 'CellTitle', description: 'Заголовок ячейки.' },
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
