export const fnCanShowStep = (popupSetupStep: number, editStep: number | null) => (stepNumber: number) =>
    (popupSetupStep >= stepNumber && (editStep === null || editStep === stepNumber)) ||
    (popupSetupStep > stepNumber && editStep !== null);

export const fnIsEditMode = (popupSetupStep: number, editStep: number | null) => (stepNumber: number) =>
    popupSetupStep === stepNumber || editStep === stepNumber;

export const popupSetupSteps = {
    PROJECT_NAME: 0,
    PACKAGES_NAME: 1,
    GRAY_TONE: 2,
    ACCENT_COLOR: 3,
    LIGHT_STROKE_SATURATION: 4,
    LIGHT_FILL_SATURATION: 5,
    DARK_STROKE_SATURATION: 6,
    DARK_FILL_SATURATION: 7,
    DONE: 8,
};
