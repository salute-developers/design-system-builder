import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { VITE_DB_SERVICE_API } from "../api/client";

const DocsPage = () => (
  <ApiReferenceReact
    configuration={{
      url: `${VITE_DB_SERVICE_API}/openapi.json`,
      hideModels: false,
    }}
  />
);

export default DocsPage;
