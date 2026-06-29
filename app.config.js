// app.config.js
// Reemplaza a app.json para poder leer la API key de Google Maps desde
// una variable de entorno (EXPO_PUBLIC_GOOGLE_MAPS_KEY) en lugar de tenerla
// escrita en el repositorio.
//
// La key debe estar en el .env (ignorado por git) y, para los builds,
// exportada en el entorno o registrada en EAS.

export default {
  expo: {
    name: 'bombonsitos',
    slug: 'BachelorApp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'bombonsitos',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/icon.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      package: 'com.franmon.bombonsitos',
      config: {
        googleMaps: {
          // Se lee de la variable de entorno; NO se escribe la key en el repo.
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission: 'La app necesita acceso a tus fotos.',
          cameraPermission: 'La app necesita la cámara para tomar fotos.',
        },
      ],
      [
        'expo-notifications',
        {
          color: '#2563EB',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'La app usa tu ubicación para geolocalizar las fotos.',
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'af011023-35a6-4ca2-a999-59e9408a7002',
      },
    },
  },
}
