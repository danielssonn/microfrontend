const rspack = require('@rspack/core');

/**
 * @type {import('@rspack/cli').Configuration}
 */
module.exports = {
  entry: './src/index.tsx',
  mode: 'development',
  experiments: {
    css: true,
  },
  devServer: {
    port: 5001,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    hot: true,
  },
  output: {
    publicPath: 'http://localhost:5001/',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: true,
                  refresh: false,  // Disable refresh for Module Federation
                },
              },
            },
          },
        },
      },
      {
        test: /\.css$/,
        type: 'css',
      },
    ],
  },
  plugins: [
    new rspack.container.ModuleFederationPlugin({
      name: 'reactRemote',
      filename: 'remoteEntry.js',
      library: { type: 'var', name: 'reactRemote' },
      exposes: {
        './App': './src/bootstrap',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.2.0',
          strictVersion: false,
          eager: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.2.0',
          strictVersion: false,
          eager: false,
        },
      },
      runtimePlugins: [],
    }),
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
    }),
  ],
};
