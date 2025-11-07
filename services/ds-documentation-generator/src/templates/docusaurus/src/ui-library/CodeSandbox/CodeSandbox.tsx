import React, { FC, HTMLAttributes, useMemo } from "react";
import { getParameters } from "codesandbox/lib/api/define";
import styled from "styled-components";
import qs from "qs";
import { useMockComponentProps } from "../../contexts/ComponentPropsContext";
import {
  USE_COMPONENT_PROPS_MOCK,
  addUseComponentPropsImport,
} from "./utils";
import { SANDBOX_STYLES } from "./sandboxStyles";

const html = `<body>
  <div id="root"></div>
</body>
`;

const StyledLink = styled.a`
  && {
    display: flex;
    align-items: center;

    padding: 6px 10px;

    font-size: 14px;
    font-weight: 600;
    color: #fff;
    border-radius: 6px;

    background-color: var(--ifm-link-color);

    text-decoration: none;
  }
`;

export interface CodeSandboxProps extends HTMLAttributes<HTMLIFrameElement> {
  /**
   * Исходный код сниппета
   */
  source: string;
  /**
   * Имя песочницы
   */
  sandboxName: string;
  /**
   * Исходный код index.js
   */
  indexSource: string;
  /**
   * Зависимости для сниппета
   */
  dependencies?: {
    [key: string]: string;
  };
  /**
   * Контент для кнопки
   */
  content?: string | JSX.Element;
}

export const CodeSandbox: FC<CodeSandboxProps> = ({
  source,
  sandboxName,
  dependencies,
  indexSource,
  content,
}) => {
  const componentProps = useMockComponentProps();

  const parameters = useMemo(() => {
    // Автоматически добавляем импорт useMockComponentProps, если он используется
    const transformedSource = addUseComponentPropsImport(source);

    const files: Record<string, { isBinary: boolean; content: any }> = {
      "package.json": {
        isBinary: false,
        // eslint-disable-next-line
        // @ts-ignore
        content: {
          name: sandboxName,
          dependencies: {
            react: "18.2.0",
            "react-dom": "18.2.0",
            "styled-components": "5.3.1",
            ...dependencies,
          },
        },
      },
      "src/index.js": {
        isBinary: false,
        content: indexSource,
      },
      "src/App.js": {
        isBinary: false,
        content: transformedSource,
      },
      "src/style.css": {
        isBinary: false,
        content: SANDBOX_STYLES,
      },
      "src/data/DATA.json": {
        isBinary: false,
        content: JSON.stringify(componentProps, null, 2),
      },
      "src/hooks/useMockComponentProps.js": {
        isBinary: false,
        content: USE_COMPONENT_PROPS_MOCK,
      },
      "public/index.html": {
        isBinary: false,
        content: html,
      },
    };

    return getParameters({ files });
  }, [source, sandboxName, dependencies, indexSource, componentProps]);

  const query = qs.stringify({
    theme: "dark",
    module: "src/App.js",
  });

  const urlParameters = qs.stringify({
    parameters,
    query,
  });

  const URL = `https://codesandbox.io/api/v1/sandboxes/define?${urlParameters}`;

  return (
    <StyledLink href={URL} target="_blank" rel="noopener noreferrer">
      {content}
    </StyledLink>
  );
};
