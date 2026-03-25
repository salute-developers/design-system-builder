import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { VITE_DS_REGISTRY_API } from "../api/client";

const DocsPage = () => (
  <ApiReferenceReact
    configuration={{
      url: `${VITE_DS_REGISTRY_API}/openapi.json`,
      hideModels: false,
    }}
  />
);

export default DocsPage;
