This directory is to be imported in any script that may need to use the Prisma Client.

If there is no directory named prisma in here, you may need to generate prisma client.
Simply make sure that you have prisma installed and have a schema.prisma file inside a directory named prisma.
Then, run the command ```npx prisma generate``` to generate the prisma client that can be used
in other scripts.

Example Import from root directory:

```javascript
import { PrismaClient } from "./generated/prisma/client.js";
const prisma = new PrismaClient();
```
