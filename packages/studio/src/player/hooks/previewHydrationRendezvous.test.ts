import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { watchPreviewHydration } from "./previewHydrationRendezvous";

function harness() {
  let current = true;
  let ready = false;
  let calls = 0;
  let unsubscribed = 0;
  let cancelled = 0;
  let timedOut = 0;
  let notify = () => {};
  let timer = () => {};
  const options = {
    isCurrent: () => current,
    initialize: () => {
      calls++;
      return ready;
    },
    subscribe: (fn: () => void) => {
      notify = fn;
      return () => {
        unsubscribed++;
      };
    },
    schedule: (fn: () => void) => {
      timer = fn;
      return () => {
        cancelled++;
      };
    },
    onTimeout: () => {
      timedOut++;
    },
  };
  return {
    options,
    ready: () => {
      ready = true;
    },
    retire: () => {
      current = false;
    },
    signal: () => notify(),
    expire: () => timer(),
    counts: () => ({ calls, unsubscribed, cancelled, timedOut }),
  };
}

describe("preview hydration rendezvous", () => {
  it("subscribes before the first initialization attempt", () => {
    const order: string[] = [];
    const stop = watchPreviewHydration({
      isCurrent: () => true,
      initialize: () => {
        order.push("initialize");
        return false;
      },
      subscribe: () => {
        order.push("subscribe");
        return () => {};
      },
      schedule: () => {
        order.push("schedule");
        return () => {};
      },
      onTimeout() {},
    });
    assert.deepEqual(order, ["subscribe", "initialize", "schedule"]);
    stop();
  });
  it("a warm adapter needs no timer and releases its listener", () => {
    const h = harness();
    h.ready();
    watchPreviewHydration(h.options);
    assert.deepEqual(h.counts(), { calls: 1, unsubscribed: 1, cancelled: 0, timedOut: 0 });
  });
  it("a later readiness signal hydrates and cancels the bound", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.ready();
    h.signal();
    assert.deepEqual(h.counts(), { calls: 2, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("duplicate messages cannot initialize twice after success", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.ready();
    h.signal();
    h.signal();
    h.expire();
    assert.equal(h.counts().calls, 2);
  });
  it("unsuccessful messages keep the same single timer", () => {
    const h = harness();
    const stop = watchPreviewHydration(h.options);
    h.signal();
    h.signal();
    assert.deepEqual(h.counts(), { calls: 3, unsubscribed: 0, cancelled: 0, timedOut: 0 });
    stop();
  });
  it("the final attempt may succeed without a message", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.ready();
    h.expire();
    assert.deepEqual(h.counts(), { calls: 2, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("timeout is not a readiness success", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.expire();
    assert.deepEqual(h.counts(), { calls: 2, unsubscribed: 1, cancelled: 1, timedOut: 1 });
  });
  it("cancel cleans both resources and disables retained callbacks", () => {
    const h = harness();
    const stop = watchPreviewHydration(h.options);
    stop();
    h.ready();
    h.signal();
    h.expire();
    assert.deepEqual(h.counts(), { calls: 1, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("cancel is idempotent", () => {
    const h = harness();
    const stop = watchPreviewHydration(h.options);
    stop();
    stop();
    assert.equal(h.counts().unsubscribed, 1);
    assert.equal(h.counts().cancelled, 1);
  });
  it("a retired frame cannot initialize from a late message", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.retire();
    h.ready();
    h.signal();
    assert.deepEqual(h.counts(), { calls: 1, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("a retired document cannot reveal a newer document on timeout", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.retire();
    h.expire();
    assert.deepEqual(h.counts(), { calls: 1, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("an initially obsolete view installs no timer or initializer", () => {
    const h = harness();
    h.retire();
    watchPreviewHydration(h.options);
    assert.deepEqual(h.counts(), { calls: 0, unsubscribed: 1, cancelled: 0, timedOut: 0 });
  });
  it("supports synchronous notification during subscription", () => {
    const h = harness();
    h.ready();
    watchPreviewHydration({
      ...h.options,
      subscribe: (notify) => {
        const unsubscribe = h.options.subscribe(notify);
        notify();
        return unsubscribe;
      },
    });
    assert.deepEqual(h.counts(), { calls: 1, unsubscribed: 1, cancelled: 0, timedOut: 0 });
  });
  it("supports a synchronous scheduler without leaking its cancellation", () => {
    const h = harness();
    watchPreviewHydration({
      ...h.options,
      schedule: (notify) => {
        const cancel = h.options.schedule(notify);
        h.ready();
        notify();
        return cancel;
      },
    });
    assert.deepEqual(h.counts(), { calls: 2, unsubscribed: 1, cancelled: 1, timedOut: 0 });
  });
  it("an initializer exception releases the subscription", () => {
    const h = harness();
    assert.throws(
      () =>
        watchPreviewHydration({
          ...h.options,
          initialize() {
            throw new Error("bad adapter");
          },
        }),
      /bad adapter/,
    );
    assert.equal(h.counts().unsubscribed, 1);
  });
  it("an exception in a later attempt cancels listener and timer", () => {
    const h = harness();
    let fail = false;
    watchPreviewHydration({
      ...h.options,
      initialize() {
        if (fail) throw new Error("gone");
        return false;
      },
    });
    fail = true;
    assert.throws(h.signal, /gone/);
    assert.equal(h.counts().unsubscribed, 1);
    assert.equal(h.counts().cancelled, 1);
  });
  it("a scheduler exception does not leave a message listener", () => {
    const h = harness();
    assert.throws(
      () =>
        watchPreviewHydration({
          ...h.options,
          schedule() {
            throw new Error("timer");
          },
        }),
      /timer/,
    );
    assert.equal(h.counts().unsubscribed, 1);
  });
  it("a message emitted from inside initialization is not reentrant", () => {
    const h = harness();
    let calls = 0;
    watchPreviewHydration({
      ...h.options,
      initialize() {
        calls++;
        h.signal();
        return true;
      },
    });
    assert.equal(calls, 1);
    assert.equal(h.counts().unsubscribed, 1);
  });
  it("a new rendezvous may recover after the old bound expired", () => {
    const h = harness();
    watchPreviewHydration(h.options);
    h.expire();
    assert.equal(h.counts().timedOut, 1);
    h.ready();
    watchPreviewHydration(h.options);
    assert.equal(h.counts().calls, 3);
    assert.equal(h.counts().unsubscribed, 2);
  });
  it("separate views never cancel or consume each other's signals", () => {
    const a = harness(),
      b = harness();
    const stopA = watchPreviewHydration(a.options);
    watchPreviewHydration(b.options);
    stopA();
    b.ready();
    b.signal();
    assert.equal(a.counts().calls, 1);
    assert.equal(b.counts().calls, 2);
    assert.equal(b.counts().timedOut, 0);
  });
});
