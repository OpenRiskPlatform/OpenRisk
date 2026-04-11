import { Generator, getConfig } from "@tanstack/router-generator";

const config = getConfig({}, process.cwd());
const generator = new Generator({ root: process.cwd(), config });

await generator.run();
