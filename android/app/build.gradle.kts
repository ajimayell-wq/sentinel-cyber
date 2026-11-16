plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Numéro de version : augmente à chaque pipeline GitLab.
val ciBuild = (System.getenv("CI_PIPELINE_IID") ?: "1").toInt()
// Clé de signature fixe (déposée par le pipeline) : chaque nouvelle APK s'installe par-dessus l'ancienne.
val fixedKey = rootProject.file("keystore/debug.p12")
// Adresse du serveur par défaut ; modifiable dans l'application (Ma veille > Serveur).
val defaultServer = System.getenv("SENTINEL_SERVER") ?: "https://raw.githubusercontent.com/ajimayell-wq/sentinel-cyber/data/api"

android {
    namespace = "ma.adess.sentinel"
    compileSdk = 36

    defaultConfig {
        applicationId = "ma.adess.sentinel"
        minSdk = 26
        targetSdk = 36
        versionCode = ciBuild
        versionName = "1.0.$ciBuild"
        buildConfigField("String", "DEFAULT_SERVER", "\"$defaultServer\"")
    }

    signingConfigs {
        getByName("debug") {
            if (fixedKey.exists()) {
                storeFile = fixedKey
                storeType = "pkcs12"
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

// La logique (lecture de l'instantané, comparaison de versions, assistant, alertes) est testée
// sur les données réelles embarquées avant chaque assemblage de l'APK.
afterEvaluate {
    tasks.named("assembleDebug") { dependsOn("testDebugUnitTest") }
}
