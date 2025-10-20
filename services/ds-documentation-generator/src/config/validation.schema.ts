import * as Joi from 'joi';

/**
 * Схема валидации переменных окружения
 * Проверяет наличие и корректность всех необходимых переменных при старте приложения
 */
export const validationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // AWS S3 (обязательные для работы с S3)
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_ENDPOINT: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_S3_BUCKET: Joi.string().required(),

  // Output (опциональные)
  OUTPUT_DIR: Joi.string().default('./output'),
});
