const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

module.exports = {
  target: 'web',
  output: {
    uniqueName: "angularHost",
    publicPath: "auto",
    scriptType: 'text/javascript'
  },
  optimization: {
    runtimeChunk: false
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "angularHost",
      remotes: {
        reactRemote: "reactRemote@http://localhost:5001/remoteEntry.js",
        reactOrange: "reactOrange@http://localhost:5002/remoteEntry.js",
      },
      shared: {
        "@angular/core": { singleton: true, strictVersion: false, requiredVersion: "auto" },
        "@angular/common": { singleton: true, strictVersion: false, requiredVersion: "auto" },
        "@angular/router": { singleton: true, strictVersion: false, requiredVersion: "auto" },
        "@angular/forms": { singleton: true, strictVersion: false, requiredVersion: "auto" },
        "rxjs": { singleton: true, strictVersion: false, requiredVersion: "auto" }
      }
    })
  ],
};
