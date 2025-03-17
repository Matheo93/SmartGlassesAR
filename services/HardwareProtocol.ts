// services/HardwareProtocol.ts
// Définit le protocole de communication avec les lunettes

export enum CommandType {
    DISPLAY = 0x01,
    HAPTIC = 0x02,
    AUDIO = 0x03,
    CAMERA = 0x04,
    SENSOR = 0x05,
    SYSTEM = 0xFF
  }
  
  export enum HapticPattern {
    SHORT_PULSE = 0x01,
    LONG_PULSE = 0x02,
    DOUBLE_PULSE = 0x03,
    LEFT_DIRECTION = 0x04,
    RIGHT_DIRECTION = 0x05,
    FORWARD_DIRECTION = 0x06,
    WARNING = 0x07,
    SUCCESS = 0x08
  }
  
  export interface CommandPacket {
    commandType: CommandType;
    operation: number;
    parameters: Uint8Array;
  }
  
  export class HardwareProtocol {
    // Encode une commande d'affichage de texte
    static encodeDisplayTextCommand(text: string, x: number, y: number, size: number): CommandPacket {
      const textBytes = new TextEncoder().encode(text);
      const params = new Uint8Array(textBytes.length + 4);
      
      params[0] = x;
      params[1] = y;
      params[2] = size;
      params[3] = textBytes.length;
      params.set(textBytes, 4);
      
      return {
        commandType: CommandType.DISPLAY,
        operation: 0x01, // Text display operation
        parameters: params
      };
    }
    
    // Encode une commande de retour haptique
    static encodeHapticCommand(pattern: HapticPattern, intensity: number): CommandPacket {
      const params = new Uint8Array(2);
      params[0] = pattern;
      params[1] = intensity;
      
      return {
        commandType: CommandType.HAPTIC,
        operation: 0x01, // Trigger haptic
        parameters: params
      };
    }
    
    // Convertit un paquet de commande en tableau d'octets pour transmission BLE
    static serializeCommandPacket(packet: CommandPacket): Uint8Array {
      const headerSize = 3; // commandType(1) + operation(1) + paramLength(1)
      const result = new Uint8Array(headerSize + packet.parameters.length);
      
      result[0] = packet.commandType;
      result[1] = packet.operation;
      result[2] = packet.parameters.length;
      result.set(packet.parameters, headerSize);
      
      return result;
    }
  }