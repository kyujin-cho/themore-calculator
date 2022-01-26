module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'simple-import-sort', 'jsdoc'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
    'plugin:jsdoc/recommended',
  ],
  rules: {
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'jsdoc/require-jsdoc': [
      1,
      {
        require: {
          ArrowFunctionExpression: true,
          ClassDeclaration: false,
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true,
        },
      },
    ],
    'jsdoc/require-returns': 0,
    'jsdoc/require-returns-type': 0,
    'jsdoc/require-param-type': 0,
    'simple-import-sort/sort': 'error',
  },
}
