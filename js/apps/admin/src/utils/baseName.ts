export const getBaseName = () => {
  const buildBaseName = import.meta.env.BASE_URL;

  if (buildBaseName === "/") {
    return "/";
  }

  return buildBaseName.replace(/\/$/, "");
};
