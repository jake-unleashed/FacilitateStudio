module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'coverage'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh', '@typescript-eslint', 'react'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    // Allow react-three-fiber JSX properties
    'react/no-unknown-property': ['error', { 
      ignore: [
        'args', 'position', 'rotation', 'scale', 'intensity', 'angle', 'penumbra',
        'roughness', 'metalness', 'wireframe', 'transparent', 'opacity', 'color',
        'makeDefault', 'fov', 'infiniteGrid', 'fadeDistance', 'sectionColor',
        'cellColor', 'sectionThickness', 'cellThickness', 'enableDamping',
        'dampingFactor', 'maxPolarAngle', 'minDistance', 'maxDistance', 'blur',
        'far', 'preset', 'shadows', 'object'
      ]
    }],
  },
};

