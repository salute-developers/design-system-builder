import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { API_BASE } from "../api/client";

const DocsPage = () => (
  <ApiReferenceReact
    configuration={{
      url: `${API_BASE}/openapi.json`,
      hideModels: false,
    }}
  />
);

export default DocsPage;
