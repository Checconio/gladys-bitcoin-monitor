import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 180000 });
const image = "bitcoin-monitor:ci";
const id = `bitcoin-monitor-test-${process.pid}-${Date.now()}`;
const manifest = JSON.parse(readFileSync("gladys-assistant-integration.json"));
const fixture = resolve("scripts/docker-fixture.mjs");
const containers = [];
let volumeCreated = false;
try {
  docker(
    "build",
    "--pull",
    "--build-arg",
    `GLADYS_INTEGRATION_MANIFEST=${JSON.stringify(manifest)}`,
    "-t",
    image,
    ".",
  );
  const metadata = JSON.parse(docker("image", "inspect", image))[0];
  if (process.env.DOCKER_DEFAULT_PLATFORM) {
    assert.equal(
      `${metadata.Os}/${metadata.Architecture}`,
      process.env.DOCKER_DEFAULT_PLATFORM,
      "built image must match the requested CI platform",
    );
  }
  const config = metadata.Config;
  assert.equal(config.User, "node");
  assert.deepEqual(config.Entrypoint, ["dumb-init", "--"]);
  assert.deepEqual(config.Cmd, ["node", "index.js"]);
  assert.deepEqual(
    JSON.parse(config.Labels["io.gladysassistant.manifest"]),
    manifest,
  );
  let rejected = false;
  try {
    docker("build", "--build-arg", "GLADYS_INTEGRATION_MANIFEST={}", ".");
  } catch (error) {
    assert.match(
      String(error.stderr),
      /embedded Gladys manifest does not match/,
    );
    rejected = true;
  }
  assert.ok(rejected, "mismatched manifest must fail the build");
  process.stdout.write(
    docker(
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/tmp",
      "--mount",
      `type=bind,src=${resolve("test")},dst=/app/test,readonly`,
      image,
      "node",
      "--test",
    ),
  );
  docker("volume", "create", id);
  volumeCreated = true;
  const common = [
    "--network",
    "none",
    "--read-only",
    "--mount",
    `type=volume,src=${id},dst=/data`,
    "--mount",
    `type=bind,src=${fixture},dst=/app/docker-fixture.mjs,readonly`,
  ];
  for (const signal of ["SIGTERM", "SIGINT"]) {
    const amount = signal === "SIGTERM" ? "0.123" : "0.456";
    const name = `${id}-${signal.toLowerCase()}`;
    containers.push(name);
    docker(
      "run",
      "-d",
      "--name",
      name,
      ...common,
      image,
      "node",
      "docker-fixture.mjs",
      "write",
      amount,
    );
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (docker("logs", name).includes("FIXTURE_READY")) {
        ready = true;
        break;
      }
      await setTimeout(250);
    }
    assert.ok(ready, "fixture must start");
    docker("stop", "--signal", signal, "--timeout", "15", name);
    assert.equal(
      docker("inspect", "--format", "{{.State.ExitCode}}", name).trim(),
      "0",
    );
    docker(
      "run",
      "--rm",
      ...common,
      image,
      "node",
      "docker-fixture.mjs",
      "read",
      amount,
    );
  }
  process.stdout.write(
    "Docker runtime, signals, manifest and persistence checks passed.\n",
  );
} finally {
  for (const name of containers) docker("rm", "-f", name);
  // Only the uniquely named disposable test volume is removed.
  if (volumeCreated) docker("volume", "rm", id);
}
