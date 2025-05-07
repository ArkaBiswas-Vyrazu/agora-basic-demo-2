# Agora Basic Demo

A basic live streaming implementation that uses the Agora API.

## Technologies Used

- NodeJS
- Express
- Passport and Express-Session for Authentication
- Express-Validator
- BcryptJS
- EJS
- Prisma
- Agora-Token
- Agora Video Web SDK
- ngrok

## Pre-requisites

1. Install relevant node modules using ```npm install```.
2. Setup a Postgresql Database. If Postgresql is not available, please edit the schema.prisma file and remove the migrations directory. Refer to the Prisma docs for more information.
3. Provide the .env values. For testing purposes, set HOSTNAME to "localhost".
    - You need to make an Agora account and create a project to get an App ID and an App Certificate.
4. Apply migrations to the Database and create the prisma client using the following:-
    ```bash
    npx prisma migrate dev --name init # Add the name flag if the migrations directory was removed
    npx prisma generate 
    ```
5. If you want to check out the audience status feature, you need to create a ngrok account, as they will provide a static domain that can be used for testing locally. After that, refer to [the Agora Docs to learn how to enable notifications.](https://docs.agora.io/en/broadcast-streaming/advanced-features/receive-notifications#enable-notifications). There, when they ask for an URL, use the following URL-
    ```javascript
    https://${ngrok-static-domain}/agora/ncsNotify
    ```
6. Everything should be ready by now. All you need to do then is simply run ```npm run dev``` to launch the application. If ngrok was used, create a new terminal window and run ```ngrok http --url=<ngrok-static-domain> <Application-Port>```. Open either the ngrok domain or your configured host to check out the demo.
