const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to fix duplicate libworklets.so when using
 * react-native-reanimated ~3.16 alongside react-native-worklets ~0.4.
 *
 * Both packages build libworklets.so via CMake, causing a conflict in
 * AGP 8.x mergeNativeLibs. The deprecated packagingOptions.pickFirst DSL
 * does not resolve CMake IMPORTED target conflicts; we must use the new
 * android.packaging.jniLibs.pickFirsts DSL introduced in AGP 7.1+.
 */
const withAndroidWorkletsFix = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    const { contents } = gradleConfig.modResults;

    if (contents.includes('withAndroidWorkletsFix')) {
      return gradleConfig;
    }

    gradleConfig.modResults.contents = contents.replace(
      /^android\s*\{/m,
      `android {
    // withAndroidWorkletsFix: resolve duplicate libworklets.so (reanimated + worklets)
    packaging {
        jniLibs {
            pickFirsts += ["lib/**/libworklets.so"]
        }
    }`
    );

    return gradleConfig;
  });
};

module.exports = withAndroidWorkletsFix;
