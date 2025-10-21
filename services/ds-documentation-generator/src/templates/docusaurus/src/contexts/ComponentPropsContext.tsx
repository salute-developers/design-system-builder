import React, { createContext, useContext, ReactNode } from "react";
import { useDynamicImport } from "../hooks";
import { Views, dataFormatter, sortPredicate, getComponentNameFromUrl } from './utils';

type ContextData = {
  viewList?: Record<string, string>;
  sizeList?: string[];
};

const ComponentPropsContext = createContext<ContextData | undefined>(undefined);

/**
 * Provider для хранения props текущего компонента
 * Автоматически определяет компонент из URL и загружает его props
 */
export const ComponentPropsProvider = ({ children, name }: {
    children: ReactNode;
    name?: string;
}) => {
  // Определяем имя компонента из URL или используем переданное
  const componentNameFromUrl = typeof window !== "undefined"
      ? getComponentNameFromUrl(window.location.pathname)
      : undefined;

  const componentName = name || componentNameFromUrl;

  if (!componentName) {
    return (
        <ComponentPropsContext.Provider value={{ viewList: {}, sizeList: [] }}>
            {children}
        </ComponentPropsContext.Provider>
    );
  }

  const { props: componentProps } = useDynamicImport("@docgen", componentName);

  const viewList = (componentProps?.view.type.value || [])
    .map(dataFormatter)
    .reduce((acc: Record<string, string>, view: string) => {
      return {
        ...acc,
        [view]: Views[view],
      };
    }, {});

  const sizeList =
    (componentProps?.size.type.value || []).map(dataFormatter).sort(sortPredicate) ||
    [];

  const value: ContextData = { viewList, sizeList };

  return (
    <ComponentPropsContext.Provider value={value}>
      {children}
    </ComponentPropsContext.Provider>
  );
};

/**
 * Хук для доступа к props текущего компонента
 * Используется исключительно для примеров внутри live code blocks
 *
 * @example
 * ```tsx live
 * function App() {
 *   const { componentProps } = useMockComponentProps();
 *   console.log(componentProps); // все props текущего компонента
 *   return <Button text="Hello" />;
 * }
 * ```
 */
export const useMockComponentProps = (): ContextData => {
  const context = useContext(ComponentPropsContext);

  if (context === undefined) {
    return { viewList: {}, sizeList: [] };
  }

  return context;
};
