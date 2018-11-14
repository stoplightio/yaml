# @stoplight/yaml

[![Maintainability](https://api.codeclimate.com/v1/badges/85d2215f8b1e8a15214f/maintainability)](https://codeclimate.com/github/stoplightio/json/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/85d2215f8b1e8a15214f/test_coverage)](https://codeclimate.com/github/stoplightio/json/test_coverage)

Useful functions when working with YAML.

- Explore the interfaces: [TSDoc](https://stoplightio.github.io/yaml)
- View the changelog: [Releases](https://github.com/stoplightio/yaml/releases)

### Installation

Supported in modern browsers and node.

```bash
# latest stable
yarn add @stoplight/yaml
```

### Usage

```ts
// basic example of parseWithPointers
import { parseWithPointers } from "@stoplight/yaml";

const result = parseWithPointers("foo: bar");
console.log(result.data); // => the {foo: "bar"} JS object
console.log(result.pointers); // => the source map with a single "#/foo" pointer that has position info for the foo property
```

- **parseWithPointers**: Like `JSON.parse(val)` but also returns a source map that includes a JSON path pointer for every property in the result (with line information).

### Contributing

1. Clone repo.
2. Create / checkout `feature/{name}`, `chore/{name}`, or `fix/{name}` branch.
3. Install deps: `yarn`.
4. Make your changes.
5. Run tests: `yarn test.prod`.
6. Stage relevant files to git.
7. Commit: `yarn commit`. _NOTE: Commits that don't follow the [conventional](https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional) format will be rejected. `yarn commit` creates this format for you, or you can put it together manually and then do a regular `git commit`._
8. Push: `git push`.
9. Open PR targeting the `develop` branch.
