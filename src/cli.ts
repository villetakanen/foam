#!/usr/bin/env node
import { Foam } from './core.js';
import { initializeProject, projectStatus, migrateMemory } from './project.js';

const [command, projectRoot = process.cwd(), scope = 'private', sourceDirectory] = process.argv.slice(2);
try {
  if (command === 'init') console.log(JSON.stringify(await initializeProject(projectRoot, scope), null, 2));
  else if (command === 'migrate') {
    if (!sourceDirectory) throw new Error('Usage: foam migrate <project-root> <scope> <source-directory>');
    console.log(JSON.stringify(await migrateMemory({ projectRoot, scope, sourceDirectory }), null, 2));
  } else if (command === 'status' || command === 'inspect' || command === 'recover') {
    const status = await projectStatus(projectRoot, scope);
    const foam = new Foam({ directory: status.directory, scope: status.scope, ...status.config.budgets,
      ...(status.config.trace ? { trace: status.config.trace } : {}),
      inference: { async infer() { throw new Error('Inspection never invokes inference'); } } });
    console.log(JSON.stringify(command === 'recover' ? await foam.recover() : { ...status, memory: await foam.status() }, null, 2));
  } else throw new Error('Usage: foam <init|status|inspect|recover|migrate> [project-root] [scope] [source-directory]');
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
