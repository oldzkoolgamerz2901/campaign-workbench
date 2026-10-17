# Setup runtime baseline

- JDK: JetBrains Runtime OpenJDK 25.0.3+9-b480.61, macOS arm64. Set JAVA_HOME to this build for developer checks. Gradle requires Java language level 25; it does not provision a vendor build.
- Node: 26.12.0; npm: 11.20.0.
- Docker client/server: 29.4.3; Compose: 5.1.4. These are observed development prerequisites, not auto-installed runtimes.
- Gradle: 9.7.0, distribution checksum in the wrapper properties.
- PostgreSQL: 18.6, multi-platform digest in compose.yaml; tests use version 18.6.
- RxJS 7.8.2, tslib 2.8.1, jsdom 30.1.3 and Prettier 3.8.1 are exact direct npm pins.

The version catalog retains the accepted baseline. Compatibility evidence belongs to the implementation plan; dependency selection alone is not a support claim.
