# SITMUN Edition Mobile Application

## Plataforma de desarrollo

**edition-mobile-app** ha sido desarrollada
utilizando el **framework Ionic**, en conjunto con **Angular** para la construcción de la interfaz y lógica de negocio, y **Capacitor** para acceder a funcionalidades nativas de los dispositivos móviles.


## REQUISITOS DEL SISTEMA

|                            |                       |                                                          |
|----------------------------|-----------------------|----------------------------------------------------------|
| Herramienta                | Versión recomendada   | Notas                                                    |
| Node.js                    | 22.x LTS              | <https://nodejs.org/es>                                  |
| npm (Node Package Manager) | 10.x                  | Se instala con Node.js                                   |
| Ionic CLI                  | 7.x                   | <https://ionicframework.com/>                            |
| Angular CLI                | 19.x                  | <https://angular.dev/installation>                       |
| Capacitor                  | 6.x                   | Incluido en Ionic                                        |
| Java JDK                   | 17.x                  | <https://www.oracle.com/es/java/technologies/downloads/> |
| Android SDK                | 34.x                  | <https://developer.android.com/studio?hl=es-419>         |
| Git                        | Cualquiera compatible | Para clonar el repositorio                               |
| Dispositivo móvil Android  | Android 13.x          | Para pruebas físicas                                     |


## CLONACIÓN DEL PROYECTO

Clonar el proyecto utilizando git en el directorio local deseado:
```bash
git clone https://github.com/sitmun/edition-mobile-app.git
```
## INSTALACIÓN DE DEPENDENCIAS

Instalar las dependencias necesarias de la aplicación:
```bash
cd ./edition-mobile-app
npm install
```
## INTEGRACIÓN CON CAPACITOR

Añadir plataforma para compilar en Android:
```bash
ionic cap add android
```

## AUTHENTICATION AND PROXY

Environment files set `authenticationPath` (default `/api/authenticate/mobile`).

Login stores an in-memory `access_token` for backend client configuration and exchanges it at `POST /api/authenticate/proxy` for a short-lived `proxy_token` used only on the middleware origin. Authorization headers are attached only when the request origin exactly matches the selected backend or middleware origin.

MBTiles estimate/create/status/file call `/proxy/{appId}/{terId}/mbtiles...` on the middleware base derived from the instance URL (`…/backend` → sibling `…/middleware`). Requests send service and layer IDs, never tile-source URLs.

## CONFIGURACIONES

1\. **Copiar configuraciones SO**

**Android:**

Copiar el fichero /resources/android/AndroidManifest.xml en /android/app/src/main


## COMPILAR Y EJECUTAR EN ANDROID

Compilar la aplicación:
```bash
ionic cap build
```
Copia los ficheros a la versión Android:
```bash
ionic cap copy android
```
Para generar la apk, es posible utilizar solo las herramientas de líneas
de comandos, obtenidas en el paquete SDK de android, o mediante Android
Studio, que tiene incorporado las mismas herramientas.

1\. Línea de comandos

Para poder ejecutar la aplicación mediante linea de comandos en un dispositivo físico debe estar conectado por USB y tener las opciones de desarrollador activadas.

Compilar y ejecutar la aplicación en el dispositivo móvil
```bash
ionic cap run android --device
```
Este comando mostrará las opciones de dispositivos y emuladores disponibles. Seleccionar el deseado.

El comando, aparte de ejecutar la app en el dispositivo elegido, genera la apk. Se encuentra en el directorio del proyecto, en
**/android/app/build/outputs/apk/debug**.
Si se prefiere usar la apk, transferir la APK al
dispositivo (por USB, correo, Drive, etc.) y abrir el archivo *.apk*
desde un **gestor de archivos** o el navegador.

2\. Instalar la app en el dispositivo a través de Android
Studio:

Abrir la aplicación en Android Studio:
```bash
ionic cap open android
```
Una vez la aplicación ha sido cargada en Android Studio, generar la APK
correspondiente en la opción Build / Generate APK de Android Studio.

El fichero generado se encuentra en el directorio del proyecto, en
**/android/app/build/outputs/apk/debug**. Transferir la APK al
dispositivo (por USB, correo, Drive, etc.) y abrir el archivo *.apk*
desde un **gestor de archivos** o el navegador.
