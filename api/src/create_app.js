import { ExpressAuth } from '@auth/express';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { maxAliasesPlugin } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthPlugin } from '@escape.tech/graphql-armor-max-depth';
import { createYoga } from '@graphql-yoga/node';
import express from 'express';

import {
  sendVerificationRequestGCNotify,
  sendVerificationRequestConsole,
} from './auth_utils.js';
import { connect_db, get_db_client } from './db_utils.js';

const {
  IS_LOCAL_ENV = false,
  FORCE_ENABLE_GCNOTIFY = false,
  MAX_SESSION_AGE = 24 * 60 * 60,
} = process.env;

export const create_app = async ({ schema, context = {} }) => {
  await connect_db();

  const app = express();

  app.set('trust proxy', true); // auth.js needs to be able to read the `X-Forwarded-*` header, if/when behind a proxy
  app.use(
    '/auth/*',
    ExpressAuth({
      providers: [
        {
          id: 'gcnotify',
          type: 'email',
          maxAge: MAX_SESSION_AGE,
          sendVerificationRequest:
            IS_LOCAL_ENV && !FORCE_ENABLE_GCNOTIFY
              ? sendVerificationRequestConsole
              : sendVerificationRequestGCNotify,
        },
      ],
      adapter: MongoDBAdapter(get_db_client().connect()),
      debug: IS_LOCAL_ENV,
    }),
  );

  const yoga = createYoga({
    schema,
    context,
    plugins: [
      // Explore https://the-guild.dev/graphql/envelop/plugins for more The Guild pluggins
      maxAliasesPlugin({ n: 4 }), // default 15
      maxDepthPlugin({ n: 6 }), // Number of depth allowed | Default: 6
    ],
    graphqlEndpoint: '/graphql',
  });

  app.use(yoga.graphqlEndpoint, yoga);

  return app;
};
