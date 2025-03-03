/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * Modified version of the one licensed by the license above.
 */

import {Subscriber, Subscription} from 'rxjs';

type ZoneSubscriberContext = {
  _zone: Zone
}&Subscriber<any>;

(Zone as any).__load_patch('rxjs', (global: any, Zone: ZoneType) => {
  const nextSource = 'rxjs.Subscriber.next';
  const errorSource = 'rxjs.Subscriber.error';
  const completeSource = 'rxjs.Subscriber.complete';

  const ObjectDefineProperties = Object.defineProperties;

  const patchSubscription = function() {
    ObjectDefineProperties(Subscription.prototype, {
      _zone: {value: null, writable: true, configurable: true},
      _zoneUnsubscribe: {value: null, writable: true, configurable: true},
      _unsubscribe: {
        get: function(this: Subscription) {
          if ((this as any)._zoneUnsubscribe || (this as any)._zoneUnsubscribeCleared) {
            return (this as any)._zoneUnsubscribe;
          }
          const proto = Object.getPrototypeOf(this);
          return proto && proto._unsubscribe;
        },
        set: function(this: Subscription, unsubscribe: any) {
          (this as any)._zone = Zone.current;
          if (!unsubscribe) {
            (this as any)._zoneUnsubscribe = unsubscribe;
            // In some operator such as `retryWhen`, the _unsubscribe
            // method will be set to null, so we need to set another flag
            // to tell that we should return null instead of finding
            // in the prototype chain.
            (this as any)._zoneUnsubscribeCleared = true;
          } else {
            (this as any)._zoneUnsubscribeCleared = false;
            (this as any)._zoneUnsubscribe = function() {
              if (this._zone && this._zone !== Zone.current) {
                return this._zone.run(unsubscribe, this, arguments);
              } else {
                return unsubscribe.apply(this, arguments);
              }
            };
          }
        }
      }
    });
  };

  const patchSubscriber = function() {
    const next = Subscriber.prototype.next;
    const error = Subscriber.prototype.error;
    const complete = Subscriber.prototype.complete;

    Object.defineProperty(Subscriber.prototype, 'destination', {
      configurable: true,
      get: function(this: Subscriber<any>) {
        return (this as any)._zoneDestination;
      },
      set: function(this: Subscriber<any>, destination: any) {
        (this as any)._zone = Zone.current;
        (this as any)._zoneDestination = destination;
      }
    });

    // patch Subscriber.next to make sure it run
    // into SubscriptionZone
    Subscriber.prototype.next = function(this: ZoneSubscriberContext) {
      const currentZone = Zone.current;
      const subscriptionZone = this._zone;

      // for performance concern, check Zone.current
      // equal with this._zone(SubscriptionZone) or not
      if (subscriptionZone && subscriptionZone !== currentZone) {
        return subscriptionZone.run(next, this, arguments as any, nextSource);
      } else {
        return next.apply(this, arguments as any);
      }
    };

    Subscriber.prototype.error = function(this: ZoneSubscriberContext) {
      const currentZone = Zone.current;
      const subscriptionZone = this._zone;

      // for performance concern, check Zone.current
      // equal with this._zone(SubscriptionZone) or not
      if (subscriptionZone && subscriptionZone !== currentZone) {
        return subscriptionZone.run(error, this, arguments as any, errorSource);
      } else {
        return error.apply(this, arguments as any);
      }
    };

    Subscriber.prototype.complete = function(this: ZoneSubscriberContext) {
      const currentZone = Zone.current;
      const subscriptionZone = this._zone;

      // for performance concern, check Zone.current
      // equal with this._zone(SubscriptionZone) or not
      if (subscriptionZone && subscriptionZone !== currentZone) {
        return subscriptionZone.run(complete, this, arguments as any, completeSource);
      } else {
        return complete.call(this);
      }
    };
  };

  patchSubscription();
  patchSubscriber();
});
