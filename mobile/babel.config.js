module.exports = function (api) {
  // NOTE: api.cache(true) is intentionally absent. api.caller() below implicitly
  // configures cache invalidation based on Metro's caller metadata (isNodeModule).
  // Combining api.cache(true)/.forever() with api.caller() throws:
  // "Caching has already been configured with .never or .forever()".

  // NativeWind's babel preset includes @babel/plugin-transform-react-jsx which
  // rewrites every file's JSX — including node_modules such as expo-router — to
  // use react-native-css-interop/jsx-runtime (wrapJSX). At runtime wrapJSX runs
  // for every JSX element creation, calling maybeHijackSafeAreaProvider and
  // looking up interopComponents.
  //
  // Applying this to expo-router/build/Route.js causes the CurrentRouteContext
  // .Provider to be created through wrapJSX. By the time withLayoutContext.js
  // calls useContextKey() → useContext(CurrentRouteContext), the context value
  // is null because the Provider and Consumer are resolving the same module but
  // the wrapJSX call path on the Provider side breaks React's normal context
  // propagation, resulting in "No filename found".
  //
  // Fix: restrict NativeWind's JSX transform to app source files only.
  // Node-modules use the standard react/jsx-runtime so expo-router's internals
  // are unaffected. App code still goes through nativewind/jsx-runtime as
  // required for className → style interop to work.
  const isNodeModule = api.caller((caller) => Boolean(caller?.isNodeModule));

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Only apply NativeWind's JSX import source to app files.
          // For node_modules this falls back to the 'react' default so that
          // expo-router, react-navigation, etc. use the standard React JSX
          // runtime without wrapJSX interference.
          jsxImportSource: isNodeModule ? undefined : 'nativewind',
        },
      ],
      // NativeWind's full preset (JSX transform + worklets) only for app code.
      ...(!isNodeModule ? ['nativewind/babel'] : []),
    ],
    plugins: [],
  };
};
