# NowPower: Backend

This is the official repository for the backend of [NowPower](https://github.com/theWatchMasters/app)

## Useful Links

- The [frontend](https://github.com/theWatchMasters/app) repository: Contains the React Native frontend powering the app
- The [specifications](https://github.com/theWatchMasters/specs) repository: Contains the specifications for the NowPower app
- The root [GitHub Organisation](https://github.com/theWatchMasters)

## Tech Stack

The backend is powered by Express.js. It uses Prisma.js as an ORM to help manage type-safe database-agnostic queries and schemas.

The backend interacts with a Postgres database due to its useful extensions (e.g., pgvector).

## Usage

Assuming `yarn@^4.9.0`, `node@^22.22.0` and Docker are installed,

1. Install dependencies
   ```shell
   yarn
   ```
2. Set up a Postgres instance
   ```shell
   docker run -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres
   ```
3. Copy `.env.example` to `.env`
   ```
   DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres?schema=public
   JWT_SECRET="enter-a-text"
   ```
4. Generate Prisma client and database
   ```shell
   yarn prisma generate && yarn prisma db push
   ```
5. Start the server
   ```shell
   yarn start
   ```

The backend then binds to `0.0.0.0:3001` and can be interacted with. To test the operation of the server, `GET /` should return `{ success: true, message: "success.hello_world" }`

## Structure

The structure of the repository is as follows

```shell
backend
├─── .vscode # The VSCode settings
├─── .yarn   # Yarn-specific files (VSCode SDKs, etc.)
├─── prisma  # The Prisma configuration
│    └─── migrations # Contains migration info
│         ├─── 20260531103244_init # An example migration, containing the initial SQL schema
│         │    └─── migration.sql  # The actual SQL file
│         ├─── 20260531112030_add_user_2fa
│         ├─── 20260601051241_add_vault
│         ├─── 20260601053233_add_finished_field
│         └───...
├─── src
│    ├─── generated/prisma # The generated Prisma client (models + client)
│    ├─── routes # Contains the route info
│    │    ├─── auth.ts # The authentication-related endpoints
│    │    └─── ...
│    └─── utils # Utilities (effectively controllers) which abstract away implementation details
│         ├─── auth # Auth controllers
│         ├─── db
│         └─── vault
├─── .env           # The environment variable file
└─── .env.example   # The template environment variables

```

## Deployment

In the future, the backend will be deployed to a Cloud Run instance with a CloudSQL instance hosting the database.

However, for development purposes, a DigitalOcean VPS hosts the backend and database.
