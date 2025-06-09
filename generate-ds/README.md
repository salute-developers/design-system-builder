# generate-ds CLI Tool

A command-line tool to generate design system component configurations from the Design System Builder API.

## Installation

```bash
cd generate-ds
npm install
npm run build
```

## Usage

```bash
# Generate components for design system ID 16
npm run dev 16

# Or using built version
npm start 16

# With custom output directory
npm run dev 16 --output ./my-output

# With custom API URL
npm run dev 16 --url http://localhost:3001

# Dry run (show what would be generated without creating files)
npm run dev 16 --dry-run
```

## Options

- `<design-system-id>` - Required. The ID of the design system to generate from
- `-o, --output <dir>` - Output directory (default: `./output`)
- `-u, --url <url>` - API base URL (default: `http://localhost:3001`)
- `--dry-run` - Show what would be generated without creating files

## Generated Structure

The tool will create the following directory structure:

```
output/
  design-system/
    src/
      components/
        Button/
          Button.config.ts
        IconButton/
          IconButton.config.ts
        Link/
          Link.config.ts
```

## Example Generated Config

```typescript
import { css } from 'styled-components';
import * as tokens from '../tokens/button';

export const config = {
    defaults: {
        'view': 'default',
        'size': 'm',
        'disabled': 'false',
        'focused': 'true'
    },
    variations: {
        view: {
            default: css`
                ${tokens.buttonColor}: var(--inverse-text-primary);
                ${tokens.buttonValueColor}: var(--inverse-text-secondary);
                ${tokens.buttonBackgroundColor}: var(--surface-solid-default);
                ${tokens.buttonLoadingBackgroundColor}: var(--surface-solid-default);
                ${tokens.buttonColorHover}: var(--inverse-text-primary-hover);
                ${tokens.buttonColorActive}: var(--inverse-text-primary-active);
            `,
            accent: css`
                ${tokens.buttonColor}: var(--on-dark-text-primary);
                ${tokens.buttonValueColor}: var(--on-dark-text-secondary);
                ${tokens.buttonBackgroundColor}: var(--surface-accent);
                ${tokens.buttonLoadingBackgroundColor}: var(--surface-accent);
                ${tokens.buttonBackgroundColorHover}: var(--surface-accent-hover);
                ${tokens.buttonBackgroundColorActive}: var(--surface-accent-active);
            `,
        },
        size: {
            m: css`
                ${tokens.buttonHeight}: 3rem;
                ${tokens.buttonWidth}: 11.25rem;
                ${tokens.buttonPadding}: 1.25rem;
                ${tokens.buttonRadius}: 0.75rem;
                // ... more tokens
            `,
        },
    },
};
```

## Prerequisites

- The Design System Builder backend must be running
- The API must be accessible at the specified URL
- The design system ID must exist and have components with variation values

## Error Handling

The tool will:
- Validate the design system ID is a number
- Check API connectivity before proceeding
- Verify the design system exists
- Handle missing components gracefully
- Provide detailed error messages 