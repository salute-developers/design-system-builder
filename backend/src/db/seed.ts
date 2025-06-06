import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

// Get database URL from environment or use default
//npm const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ds_builder';
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // // Clear existing data in correct order (respecting foreign keys)
    // console.log('🧹 Clearing existing data...');
    // await db.delete(schema.tokenVariations);
    // await db.delete(schema.tokens);
    // await db.delete(schema.variations);
    // await db.delete(schema.designSystemComponents);
    // await db.delete(schema.components);
    // await db.delete(schema.designSystems);

    // // Create Design System
    // console.log('📊 Creating design system...');
    // const [designSystem] = await db.insert(schema.designSystems).values({
    //   name: 'Mobile Design System',
    //   description: 'Comprehensive design system for mobile applications'
    // }).returning();

    // Create Components
    console.log('🔧 Creating components...');
    const [buttonComponent] = await db.insert(schema.components).values({
      name: 'Button',
      description: 'Standard button component for user interactions'
    }).returning();

    const [iconButtonComponent] = await db.insert(schema.components).values({
      name: 'IconButton',
      description: 'Button component with icon support'
    }).returning();

    const [linkComponent] = await db.insert(schema.components).values({
      name: 'Link',
      description: 'Clickable link component for navigation'
    }).returning();

    // // Connect components to design system
    // await db.insert(schema.designSystemComponents).values([
    //   { designSystemId: designSystem.id, componentId: buttonComponent.id },
    //   { designSystemId: designSystem.id, componentId: iconButtonComponent.id },
    //   { designSystemId: designSystem.id, componentId: linkComponent.id }
    // ]);

    // Create Variations for each component
    console.log('🎨 Creating variations...');
    
    // Button variations (from web config - first level keys only)
    const buttonVariations = [
      { name: 'view', description: 'Visual appearance variation (default, primary, accent, secondary, clear, success, warning, critical, dark, black, white)' },
      { name: 'size', description: 'Size variation (xl, xlr, l, lr, m, mr, s, sr, xs, xsr, xxs)' },
      { name: 'disabled', description: 'Disabled state variation' },
      { name: 'focused', description: 'Focused state variation' },
      { name: 'stretching', description: 'Stretching behavior variation (auto, filled, fixed)' }
    ];

    const insertedButtonVariations = [];
    for (const variation of buttonVariations) {
      const [insertedVariation] = await db.insert(schema.variations).values({
        name: variation.name,
        description: variation.description,
        componentId: buttonComponent.id
      }).returning();
      insertedButtonVariations.push(insertedVariation);
    }

    // IconButton variations (from web config - first level keys only)
    const iconButtonVariations = [
      { name: 'view', description: 'Visual appearance variation (default, accent, secondary, clear, success, warning, critical, dark, black, white)' },
      { name: 'size', description: 'Size variation (xl, l, m, s, xs, xxs)' },
      { name: 'disabled', description: 'Disabled state variation' },
      { name: 'focused', description: 'Focused state variation' }
    ];

    const insertedIconButtonVariations = [];
    for (const variation of iconButtonVariations) {
      const [insertedVariation] = await db.insert(schema.variations).values({
        name: variation.name,
        description: variation.description,
        componentId: iconButtonComponent.id
      }).returning();
      insertedIconButtonVariations.push(insertedVariation);
    }

    // Link variations (from web config - first level keys only)
    const linkVariations = [
      { name: 'view', description: 'Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)' },
      { name: 'disabled', description: 'Disabled state variation' },
      { name: 'focused', description: 'Focused state variation' }
    ];

    const insertedLinkVariations = [];
    for (const variation of linkVariations) {
      const [insertedVariation] = await db.insert(schema.variations).values({
        name: variation.name,
        description: variation.description,
        componentId: linkComponent.id
      }).returning();
      insertedLinkVariations.push(insertedVariation);
    }

    // Create Tokens
    console.log('🎯 Creating tokens...');

    // Button Tokens (updated to match web config)
    const buttonTokens = [
      {
        name: 'buttonColor',
        description: 'цвет текста кнопки',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'android:textColor',
        composeParam: 'textColor',
        iosParam: 'textColor',
        webParam: 'buttonColor'
      },
      {
        name: 'buttonValueColor',
        description: 'цвет дополнительного текста',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'android:textColorSecondary',
        composeParam: 'valueColor',
        iosParam: 'valueColor',
        webParam: 'buttonValueColor'
      },
      {
        name: 'buttonBackgroundColor',
        description: 'цвет фона кнопки',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'backgroundTint',
        composeParam: 'backgroundColor',
        iosParam: 'backgroundColor',
        webParam: 'buttonBackgroundColor'
      },
      {
        name: 'buttonLoadingBackgroundColor',
        description: 'цвет фона кнопки при загрузке',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'sd_loadingBackgroundTint',
        composeParam: 'loadingBackgroundColor',
        iosParam: 'loadingBackgroundColor',
        webParam: 'buttonLoadingBackgroundColor'
      },
      {
        name: 'buttonColorHover',
        description: 'цвет текста при наведении',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'android:textColorPressed',
        composeParam: 'textColorHover',
        iosParam: 'textColorHover',
        webParam: 'buttonColorHover'
      },
      {
        name: 'buttonColorActive',
        description: 'цвет текста при нажатии',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'android:textColorActive',
        composeParam: 'textColorActive',
        iosParam: 'textColorActive',
        webParam: 'buttonColorActive'
      },
      {
        name: 'buttonBackgroundColorHover',
        description: 'цвет фона при наведении',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'backgroundTintHover',
        composeParam: 'backgroundColorHover',
        iosParam: 'backgroundColorHover',
        webParam: 'buttonBackgroundColorHover'
      },
      {
        name: 'buttonBackgroundColorActive',
        description: 'цвет фона при нажатии',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'backgroundTintActive',
        composeParam: 'backgroundColorActive',
        iosParam: 'backgroundColorActive',
        webParam: 'buttonBackgroundColorActive'
      },
      {
        name: 'buttonHeight',
        description: 'высота кнопки',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:minHeight',
        composeParam: 'height',
        iosParam: 'height',
        webParam: 'buttonHeight'
      },
      {
        name: 'buttonWidth',
        description: 'ширина кнопки',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:minWidth',
        composeParam: 'width',
        iosParam: 'width',
        webParam: 'buttonWidth'
      },
      {
        name: 'buttonPadding',
        description: 'внутренние отступы',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:padding',
        composeParam: 'padding',
        iosParam: 'padding',
        webParam: 'buttonPadding'
      },
      {
        name: 'buttonRadius',
        description: 'радиус скругления',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'sd_shapeAppearance',
        composeParam: 'shape',
        iosParam: 'cornerRadius',
        webParam: 'buttonRadius'
      },
      {
        name: 'buttonFontFamily',
        description: 'семейство шрифта',
        type: 'string',
        componentId: buttonComponent.id,
        xmlParam: 'android:fontFamily',
        composeParam: 'fontFamily',
        iosParam: 'fontFamily',
        webParam: 'buttonFontFamily'
      },
      {
        name: 'buttonFontSize',
        description: 'размер шрифта',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:textSize',
        composeParam: 'fontSize',
        iosParam: 'fontSize',
        webParam: 'buttonFontSize'
      },
      {
        name: 'buttonFontStyle',
        description: 'стиль шрифта',
        type: 'string',
        componentId: buttonComponent.id,
        xmlParam: 'android:textStyle',
        composeParam: 'fontStyle',
        iosParam: 'fontStyle',
        webParam: 'buttonFontStyle'
      },
      {
        name: 'buttonFontWeight',
        description: 'толщина шрифта',
        type: 'string',
        componentId: buttonComponent.id,
        xmlParam: 'android:textWeight',
        composeParam: 'fontWeight',
        iosParam: 'fontWeight',
        webParam: 'buttonFontWeight'
      },
      {
        name: 'buttonLetterSpacing',
        description: 'межбуквенное расстояние',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:letterSpacing',
        composeParam: 'letterSpacing',
        iosParam: 'letterSpacing',
        webParam: 'buttonLetterSpacing'
      },
      {
        name: 'buttonLineHeight',
        description: 'высота строки',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'android:lineHeight',
        composeParam: 'lineHeight',
        iosParam: 'lineHeight',
        webParam: 'buttonLineHeight'
      },
      {
        name: 'buttonSpinnerSize',
        description: 'размер индикатора загрузки',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'sd_spinnerSize',
        composeParam: 'spinnerSize',
        iosParam: 'spinnerSize',
        webParam: 'buttonSpinnerSize'
      },
      {
        name: 'buttonSpinnerColor',
        description: 'цвет индикатора загрузки',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'sd_spinnerTint',
        composeParam: 'spinnerColor',
        iosParam: 'spinnerColor',
        webParam: 'buttonSpinnerColor'
      },
      {
        name: 'buttonLeftContentMargin',
        description: 'отступ левого контента',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'sd_leftContentMargin',
        composeParam: 'leftContentMargin',
        iosParam: 'leftContentMargin',
        webParam: 'buttonLeftContentMargin'
      },
      {
        name: 'buttonRightContentMargin',
        description: 'отступ правого контента',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'sd_rightContentMargin',
        composeParam: 'rightContentMargin',
        iosParam: 'rightContentMargin',
        webParam: 'buttonRightContentMargin'
      },
      {
        name: 'buttonValueMargin',
        description: 'отступ дополнительного текста',
        type: 'dimension',
        componentId: buttonComponent.id,
        xmlParam: 'sd_valueMargin',
        composeParam: 'valueMargin',
        iosParam: 'valueMargin',
        webParam: 'buttonValueMargin'
      },
      {
        name: 'buttonDisabledOpacity',
        description: 'прозрачность в отключенном состоянии',
        type: 'number',
        componentId: buttonComponent.id,
        xmlParam: 'android:alpha',
        composeParam: 'disabledOpacity',
        iosParam: 'disabledOpacity',
        webParam: 'buttonDisabledOpacity'
      },
      {
        name: 'buttonFocusColor',
        description: 'цвет фокуса',
        type: 'color',
        componentId: buttonComponent.id,
        xmlParam: 'sd_focusColor',
        composeParam: 'focusColor',
        iosParam: 'focusColor',
        webParam: 'buttonFocusColor'
      }
    ];

    // IconButton Tokens (updated to match web config)
    const iconButtonTokens = [
      {
        name: 'iconButtonColor',
        description: 'цвет иконки',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_iconTint',
        composeParam: 'iconColor',
        iosParam: 'iconColor',
        webParam: 'iconButtonColor'
      },
      {
        name: 'iconButtonBackgroundColor',
        description: 'цвет фона кнопки',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'backgroundTint',
        composeParam: 'backgroundColor',
        iosParam: 'backgroundColor',
        webParam: 'iconButtonBackgroundColor'
      },
      {
        name: 'iconButtonLoadingBackgroundColor',
        description: 'цвет фона при загрузке',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_loadingBackgroundTint',
        composeParam: 'loadingBackgroundColor',
        iosParam: 'loadingBackgroundColor',
        webParam: 'iconButtonLoadingBackgroundColor'
      },
      {
        name: 'iconButtonColorHover',
        description: 'цвет иконки при наведении',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_iconTintHover',
        composeParam: 'iconColorHover',
        iosParam: 'iconColorHover',
        webParam: 'iconButtonColorHover'
      },
      {
        name: 'iconButtonColorActive',
        description: 'цвет иконки при нажатии',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_iconTintActive',
        composeParam: 'iconColorActive',
        iosParam: 'iconColorActive',
        webParam: 'iconButtonColorActive'
      },
      {
        name: 'iconButtonBackgroundColorHover',
        description: 'цвет фона при наведении',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'backgroundTintHover',
        composeParam: 'backgroundColorHover',
        iosParam: 'backgroundColorHover',
        webParam: 'iconButtonBackgroundColorHover'
      },
      {
        name: 'iconButtonBackgroundColorActive',
        description: 'цвет фона при нажатии',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'backgroundTintActive',
        composeParam: 'backgroundColorActive',
        iosParam: 'backgroundColorActive',
        webParam: 'iconButtonBackgroundColorActive'
      },
      {
        name: 'iconButtonHeight',
        description: 'высота кнопки',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:minHeight',
        composeParam: 'height',
        iosParam: 'height',
        webParam: 'iconButtonHeight'
      },
      {
        name: 'iconButtonWidth',
        description: 'ширина кнопки',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:minWidth',
        composeParam: 'width',
        iosParam: 'width',
        webParam: 'iconButtonWidth'
      },
      {
        name: 'iconButtonPadding',
        description: 'внутренние отступы',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:padding',
        composeParam: 'padding',
        iosParam: 'padding',
        webParam: 'iconButtonPadding'
      },
      {
        name: 'iconButtonRadius',
        description: 'радиус скругления',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_shapeAppearance',
        composeParam: 'shape',
        iosParam: 'cornerRadius',
        webParam: 'iconButtonRadius'
      },
      {
        name: 'iconButtonFontFamily',
        description: 'семейство шрифта',
        type: 'string',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:fontFamily',
        composeParam: 'fontFamily',
        iosParam: 'fontFamily',
        webParam: 'iconButtonFontFamily'
      },
      {
        name: 'iconButtonFontSize',
        description: 'размер шрифта',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:textSize',
        composeParam: 'fontSize',
        iosParam: 'fontSize',
        webParam: 'iconButtonFontSize'
      },
      {
        name: 'iconButtonFontStyle',
        description: 'стиль шрифта',
        type: 'string',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:textStyle',
        composeParam: 'fontStyle',
        iosParam: 'fontStyle',
        webParam: 'iconButtonFontStyle'
      },
      {
        name: 'iconButtonFontWeight',
        description: 'толщина шрифта',
        type: 'string',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:textWeight',
        composeParam: 'fontWeight',
        iosParam: 'fontWeight',
        webParam: 'iconButtonFontWeight'
      },
      {
        name: 'iconButtonLetterSpacing',
        description: 'межбуквенное расстояние',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:letterSpacing',
        composeParam: 'letterSpacing',
        iosParam: 'letterSpacing',
        webParam: 'iconButtonLetterSpacing'
      },
      {
        name: 'iconButtonLineHeight',
        description: 'высота строки',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:lineHeight',
        composeParam: 'lineHeight',
        iosParam: 'lineHeight',
        webParam: 'iconButtonLineHeight'
      },
      {
        name: 'iconButtonSpinnerSize',
        description: 'размер индикатора загрузки',
        type: 'dimension',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_spinnerSize',
        composeParam: 'spinnerSize',
        iosParam: 'spinnerSize',
        webParam: 'iconButtonSpinnerSize'
      },
      {
        name: 'iconButtonSpinnerColor',
        description: 'цвет индикатора загрузки',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_spinnerTint',
        composeParam: 'spinnerColor',
        iosParam: 'spinnerColor',
        webParam: 'iconButtonSpinnerColor'
      },
      {
        name: 'iconButtonDisabledOpacity',
        description: 'прозрачность в отключенном состоянии',
        type: 'number',
        componentId: iconButtonComponent.id,
        xmlParam: 'android:alpha',
        composeParam: 'disabledOpacity',
        iosParam: 'disabledOpacity',
        webParam: 'iconButtonDisabledOpacity'
      },
      {
        name: 'iconButtonFocusColor',
        description: 'цвет фокуса',
        type: 'color',
        componentId: iconButtonComponent.id,
        xmlParam: 'sd_focusColor',
        composeParam: 'focusColor',
        iosParam: 'focusColor',
        webParam: 'iconButtonFocusColor'
      }
    ];

    // Link Tokens (updated to match web config)
    const linkTokens = [
      {
        name: 'linkFontFamily',
        description: 'семейство шрифта ссылки',
        type: 'string',
        componentId: linkComponent.id,
        xmlParam: 'android:fontFamily',
        composeParam: 'fontFamily',
        iosParam: 'fontFamily',
        webParam: 'linkFontFamily'
      },
      {
        name: 'linkColor',
        description: 'цвет текста ссылки',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColor',
        composeParam: 'textColor',
        iosParam: 'textColor',
        webParam: 'linkColor'
      },
      {
        name: 'linkColorHover',
        description: 'цвет текста ссылки при наведении',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColorPressed',
        composeParam: 'textColorHover',
        iosParam: 'textColorHover',
        webParam: 'linkColorHover'
      },
      {
        name: 'linkColorActive',
        description: 'цвет текста ссылки при нажатии',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColorActive',
        composeParam: 'textColorActive',
        iosParam: 'textColorActive',
        webParam: 'linkColorActive'
      },
      {
        name: 'linkColorVisited',
        description: 'цвет посещенной ссылки',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColorVisited',
        composeParam: 'textColorVisited',
        iosParam: 'textColorVisited',
        webParam: 'linkColorVisited'
      },
      {
        name: 'linkColorVisitedHover',
        description: 'цвет посещенной ссылки при наведении',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColorVisitedHover',
        composeParam: 'textColorVisitedHover',
        iosParam: 'textColorVisitedHover',
        webParam: 'linkColorVisitedHover'
      },
      {
        name: 'linkColorVisitedActive',
        description: 'цвет посещенной ссылки при нажатии',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'android:textColorVisitedActive',
        composeParam: 'textColorVisitedActive',
        iosParam: 'textColorVisitedActive',
        webParam: 'linkColorVisitedActive'
      },
      {
        name: 'linkUnderlineBorder',
        description: 'толщина подчеркивания',
        type: 'dimension',
        componentId: linkComponent.id,
        xmlParam: 'android:textUnderline',
        composeParam: 'textDecoration',
        iosParam: 'underlineThickness',
        webParam: 'linkUnderlineBorder'
      },
      {
        name: 'linkDisabledOpacity',
        description: 'прозрачность в отключенном состоянии',
        type: 'number',
        componentId: linkComponent.id,
        xmlParam: 'android:alpha',
        composeParam: 'disabledOpacity',
        iosParam: 'disabledOpacity',
        webParam: 'linkDisabledOpacity'
      },
      {
        name: 'linkColorFocus',
        description: 'цвет ссылки в фокусе',
        type: 'color',
        componentId: linkComponent.id,
        xmlParam: 'sd_focusColor',
        composeParam: 'focusColor',
        iosParam: 'focusColor',
        webParam: 'linkColorFocus'
      }
    ];

    // Insert all tokens
    const allTokens = [...buttonTokens, ...iconButtonTokens, ...linkTokens];
    const insertedTokens = await db.insert(schema.tokens).values(allTokens).returning();

    console.log('🔗 Creating token-variation assignments...');

    // Assign tokens to variations based on web config structure
    const tokenVariationAssignments = [];

    // Get token IDs organized by component
    const buttonTokenIds = insertedTokens
      .filter(token => token.componentId === buttonComponent.id)
      .reduce((acc, token) => {
        acc[token.name] = token.id;
        return acc;
      }, {} as Record<string, number>);

    const iconButtonTokenIds = insertedTokens
      .filter(token => token.componentId === iconButtonComponent.id)
      .reduce((acc, token) => {
        acc[token.name] = token.id;
        return acc;
      }, {} as Record<string, number>);

    const linkTokenIds = insertedTokens
      .filter(token => token.componentId === linkComponent.id)
      .reduce((acc, token) => {
        acc[token.name] = token.id;
        return acc;
      }, {} as Record<string, number>);

    // Get variation IDs organized by component and name
    const buttonVariationIds = insertedButtonVariations.reduce((acc, variation) => {
      acc[variation.name] = variation.id;
      return acc;
    }, {} as Record<string, number>);

    const iconButtonVariationIds = insertedIconButtonVariations.reduce((acc, variation) => {
      acc[variation.name] = variation.id;
      return acc;
    }, {} as Record<string, number>);

    const linkVariationIds = insertedLinkVariations.reduce((acc, variation) => {
      acc[variation.name] = variation.id;
      return acc;
    }, {} as Record<string, number>);

    // Button token-variation assignments based on web config
    // Core styling tokens that apply to view variations
    const buttonViewTokens = [
      'buttonColor', 'buttonValueColor', 'buttonBackgroundColor', 'buttonLoadingBackgroundColor',
      'buttonColorHover', 'buttonColorActive', 'buttonBackgroundColorHover', 'buttonBackgroundColorActive',
      'buttonSpinnerColor'
    ];
    
    // Size-related tokens that apply to size variations
    const buttonSizeTokens = [
      'buttonHeight', 'buttonWidth', 'buttonPadding', 'buttonRadius',
      'buttonFontSize', 'buttonFontWeight', 'buttonLetterSpacing', 'buttonLineHeight',
      'buttonSpinnerSize', 'buttonLeftContentMargin', 'buttonRightContentMargin', 'buttonValueMargin'
    ];

    // Typography tokens that can apply to all variations
    const buttonTypographyTokens = ['buttonFontFamily', 'buttonFontStyle'];

    // State-specific tokens
    const buttonDisabledTokens = ['buttonDisabledOpacity'];
    const buttonFocusTokens = ['buttonFocusColor'];

    // Assign button tokens to appropriate variations
    for (const tokenName of buttonViewTokens) {
      if (buttonTokenIds[tokenName] && buttonVariationIds.view) {
        tokenVariationAssignments.push({ tokenId: buttonTokenIds[tokenName], variationId: buttonVariationIds.view });
      }
    }
    
    for (const tokenName of buttonSizeTokens) {
      if (buttonTokenIds[tokenName] && buttonVariationIds.size) {
        tokenVariationAssignments.push({ tokenId: buttonTokenIds[tokenName], variationId: buttonVariationIds.size });
      }
    }

    for (const tokenName of buttonTypographyTokens) {
      if (buttonTokenIds[tokenName]) {
        // Typography applies to all variations
        for (const variation of insertedButtonVariations) {
          tokenVariationAssignments.push({ tokenId: buttonTokenIds[tokenName], variationId: variation.id });
        }
      }
    }

    for (const tokenName of buttonDisabledTokens) {
      if (buttonTokenIds[tokenName] && buttonVariationIds.disabled) {
        tokenVariationAssignments.push({ tokenId: buttonTokenIds[tokenName], variationId: buttonVariationIds.disabled });
      }
    }

    for (const tokenName of buttonFocusTokens) {
      if (buttonTokenIds[tokenName] && buttonVariationIds.focused) {
        tokenVariationAssignments.push({ tokenId: buttonTokenIds[tokenName], variationId: buttonVariationIds.focused });
      }
    }

    // Stretching tokens
    if (buttonTokenIds.buttonWidth && buttonVariationIds.stretching) {
      tokenVariationAssignments.push({ tokenId: buttonTokenIds.buttonWidth, variationId: buttonVariationIds.stretching });
    }

    // IconButton token-variation assignments based on web config
    const iconButtonViewTokens = [
      'iconButtonColor', 'iconButtonBackgroundColor', 'iconButtonLoadingBackgroundColor',
      'iconButtonColorHover', 'iconButtonColorActive', 'iconButtonBackgroundColorHover', 
      'iconButtonBackgroundColorActive', 'iconButtonSpinnerColor'
    ];

    const iconButtonSizeTokens = [
      'iconButtonHeight', 'iconButtonWidth', 'iconButtonPadding', 'iconButtonRadius',
      'iconButtonFontSize', 'iconButtonFontWeight', 'iconButtonLetterSpacing', 'iconButtonLineHeight',
      'iconButtonSpinnerSize'
    ];

    const iconButtonTypographyTokens = ['iconButtonFontFamily', 'iconButtonFontStyle'];
    const iconButtonDisabledTokens = ['iconButtonDisabledOpacity'];
    const iconButtonFocusTokens = ['iconButtonFocusColor'];

    // Assign iconButton tokens to appropriate variations
    for (const tokenName of iconButtonViewTokens) {
      if (iconButtonTokenIds[tokenName] && iconButtonVariationIds.view) {
        tokenVariationAssignments.push({ tokenId: iconButtonTokenIds[tokenName], variationId: iconButtonVariationIds.view });
      }
    }
    
    for (const tokenName of iconButtonSizeTokens) {
      if (iconButtonTokenIds[tokenName] && iconButtonVariationIds.size) {
        tokenVariationAssignments.push({ tokenId: iconButtonTokenIds[tokenName], variationId: iconButtonVariationIds.size });
      }
    }

    for (const tokenName of iconButtonTypographyTokens) {
      if (iconButtonTokenIds[tokenName]) {
        for (const variation of insertedIconButtonVariations) {
          tokenVariationAssignments.push({ tokenId: iconButtonTokenIds[tokenName], variationId: variation.id });
        }
      }
    }

    for (const tokenName of iconButtonDisabledTokens) {
      if (iconButtonTokenIds[tokenName] && iconButtonVariationIds.disabled) {
        tokenVariationAssignments.push({ tokenId: iconButtonTokenIds[tokenName], variationId: iconButtonVariationIds.disabled });
      }
    }

    for (const tokenName of iconButtonFocusTokens) {
      if (iconButtonTokenIds[tokenName] && iconButtonVariationIds.focused) {
        tokenVariationAssignments.push({ tokenId: iconButtonTokenIds[tokenName], variationId: iconButtonVariationIds.focused });
      }
    }

    // Link token-variation assignments based on web config
    const linkViewTokens = [
      'linkColor', 'linkColorHover', 'linkColorActive', 'linkColorVisited',
      'linkColorVisitedHover', 'linkColorVisitedActive', 'linkUnderlineBorder'
    ];

    const linkTypographyTokens = ['linkFontFamily'];
    const linkDisabledTokens = ['linkDisabledOpacity'];
    const linkFocusTokens = ['linkColorFocus'];

    // Assign link tokens to appropriate variations
    for (const tokenName of linkViewTokens) {
      if (linkTokenIds[tokenName] && linkVariationIds.view) {
        tokenVariationAssignments.push({ tokenId: linkTokenIds[tokenName], variationId: linkVariationIds.view });
      }
    }

    for (const tokenName of linkTypographyTokens) {
      if (linkTokenIds[tokenName]) {
        for (const variation of insertedLinkVariations) {
          tokenVariationAssignments.push({ tokenId: linkTokenIds[tokenName], variationId: variation.id });
        }
      }
    }

    for (const tokenName of linkDisabledTokens) {
      if (linkTokenIds[tokenName] && linkVariationIds.disabled) {
        tokenVariationAssignments.push({ tokenId: linkTokenIds[tokenName], variationId: linkVariationIds.disabled });
      }
    }

    for (const tokenName of linkFocusTokens) {
      if (linkTokenIds[tokenName] && linkVariationIds.focused) {
        tokenVariationAssignments.push({ tokenId: linkTokenIds[tokenName], variationId: linkVariationIds.focused });
      }
    }

    await db.insert(schema.tokenVariations).values(tokenVariationAssignments);

    console.log('✅ Seed completed successfully!');
    console.log('📊 Created:');
    // console.log(`   • 1 Design System`);
    console.log(`   • 3 Components (Button, IconButton, Link)`);
    console.log(`   • ${insertedButtonVariations.length} Button Variations (view, size, disabled, focused, stretching)`);
    console.log(`   • ${insertedIconButtonVariations.length} IconButton Variations`);
    console.log(`   • ${insertedLinkVariations.length} Link Variations`);
    console.log(`   • ${allTokens.length} Tokens`);
    console.log(`   • ${tokenVariationAssignments.length} Token-Variation assignments`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run seed if this file is executed directly
if (process.argv[1] === __filename || process.argv[1].endsWith('seed.ts')) {
  seed().catch((error: any) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export { seed }; 