export class DeviceRegistry {
  constructor() {
    this.devices = new Map();
  }

  sync(devices = []) {
    this.devices.clear();
    for (const device of devices) this.upsert(device);
  }

  upsert(device) {
    if (!device?.external_id) return;
    this.devices.set(
      device.external_id,
      new Set(
        (device.features ?? [])
          .map((feature) => feature.external_id)
          .filter(Boolean),
      ),
    );
  }

  remove(device) {
    if (device?.external_id) this.devices.delete(device.external_id);
  }

  hasDevice(externalId) {
    return this.devices.has(externalId);
  }

  hasFeature(externalId) {
    for (const features of this.devices.values()) {
      if (features.has(externalId)) return true;
    }
    return false;
  }
}
