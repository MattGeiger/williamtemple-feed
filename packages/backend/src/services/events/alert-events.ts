import { EventEmitter } from 'events';
import { Alert } from '@prisma/client';

class AlertEventEmitter extends EventEmitter {
  private static instance: AlertEventEmitter;

  private constructor() {
    super();
  }

  public static getInstance(): AlertEventEmitter {
    if (!AlertEventEmitter.instance) {
      AlertEventEmitter.instance = new AlertEventEmitter();
    }
    return AlertEventEmitter.instance;
  }

  emitNewAlert(alert: Alert) {
    this.emit('newAlert', alert);
  }

  emitAlertUpdate(alert: Alert) {
    this.emit('alertUpdate', alert);
  }
}

export const alertEventEmitter = AlertEventEmitter.getInstance();