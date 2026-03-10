const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to pin the Gradle wrapper to 8.13.
 *
 * React Native 0.76 ships with Gradle 8.10.2 by default. This plugin upgrades
 * to 8.13 for improved compatibility and bug fixes.
 *
 * Note: Java 21 (LTS) is the recommended JDK for Android builds.
 * Java 25 is NOT currently supported by any Gradle/AGP version in this stack —
 * downgrade to Java 21 if you see "Unsupported class file major version 69".
 *
 * On Windows, ensure Windows Long Path support is enabled if you hit CMake/ninja
 * "No such file or directory" errors caused by deep node_modules paths:
 *   reg add HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled /t REG_DWORD /d 1 /f
 * Then restart and rebuild.
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
