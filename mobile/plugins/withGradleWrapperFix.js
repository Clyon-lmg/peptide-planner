const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to upgrade the Gradle wrapper to 8.13,
 * which is required when building with Java 25 (class file major version 69).
 * Gradle 8.10.2 (the RN 0.76 default) only supports up to Java 23.
 */
const withGradleWrapperFix = (config) => {
  return withDangerousMod(config, [
    'android',
    async (dangerousConfig) => {
      const wrapperPropsPath = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (!fs.existsSync(wrapperPropsPath)) {
        return dangerousConfig;
      }

      let contents = fs.readFileSync(wrapperPropsPath, 'utf8');

      // Replace any gradle wrapper distribution URL with 8.13
      contents = contents.replace(
        /distributionUrl=.*gradle-[\d.]+-.*\.zip/,
        'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-all.zip'
      );

      fs.writeFileSync(wrapperPropsPath, contents);
      return dangerousConfig;
    },
  ]);
};

module.exports = withGradleWrapperFix;
