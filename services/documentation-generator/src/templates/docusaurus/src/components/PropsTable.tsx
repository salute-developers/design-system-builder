import React, { FC } from "react";
import { PropsTable as PropsTableView } from "../ui-library";

import { useDynamicImport } from "../hooks";

export const PropsTable: FC<{ name: string; exclude?: string[] }> = ({
  name,
  exclude,
}) => {
  const { props } = useDynamicImport("@docgen", name);

  if (!props) {
    return null;
  }

  return <PropsTableView props={props} exclude={exclude} />;
};
