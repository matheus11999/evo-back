const axios = require('axios');
const prisma = require('../utils/prisma');
const ApiLogger = require('../utils/apiLogger');
const fs = require('fs');
const path = require('path');

class EvolutionApiService {
  constructor() {
    this.baseURL = null;
    this.apiKey = null;
    this.init();
  }

  async init() {
    try {
      const config = await prisma.config.findFirst();
      if (config) {
        this.baseURL = config.evolutionUrl;
        this.apiKey = config.evolutionKey;
      }
    } catch (error) {
      console.log('Config não encontrada, usando variáveis de ambiente');
      this.baseURL = process.env.EVOLUTION_API_URL;
      this.apiKey = process.env.EVOLUTION_API_KEY;
    }
  }

  async updateConfig() {
    await this.init();
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey
    };
  }

  // Método auxiliar para fazer requisições com logging
  async makeRequest(method, url, data = null) {
    const startTime = Date.now();
    const config = {
      method,
      url,
      headers: this.getHeaders(),
      baseURL: this.baseURL
    };
    
    if (data) {
      config.data = data;
    }
    
    try {
      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      
      // Log da requisição bem-sucedida
      await ApiLogger.logRequest(config, response, null, responseTime);
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log da requisição com erro
      await ApiLogger.logRequest(config, null, error, responseTime);
      
      throw error;
    }
  }

  // Testar conexão com a API - baseado na documentação v2.2.2
  async testConnection() {
    try {
      const response = await this.makeRequest('GET', '/instance/fetchInstances');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Criar nova instância - Evolution API v2.2.2
  async createInstance(instanceName, phoneNumber) {
    try {
      const payload = {
        instanceName: instanceName,
        integration: "WHATSAPP-BAILEYS",
        token: this.apiKey,
        number: phoneNumber,
        qrcode: true,
        typebot: "",
        chatwoot_account_id: "",
        chatwoot_token: "",
        chatwoot_url: "",
        chatwoot_sign_msg: false,
        chatwoot_reopen_conversation: false,
        chatwoot_conversation_pending: false,
        webhook_url: "",
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
          "CONNECTION_UPDATE"
        ],
        reject_call: false,
        msg_call: "",
        groups_ignore: true,
        always_online: false,
        read_messages: false,
        read_status: false,
        sync_full_history: false
      };

      const response = await this.makeRequest('POST', '/instance/create', payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }


  // Buscar QR Code da instância - Evolution API v2.2.2
  async getQRCode(instanceName) {
    try {
      // Primeiro, verificar se a instância existe e seu status
      const statusResponse = await this.makeRequest('GET', `/instance/connectionState/${instanceName}`);
      
      console.log('Status da instância:', statusResponse.data);
      
      // Se já estiver conectada, retornar info
      if (statusResponse.data?.instance?.state === 'open') {
        return { 
          success: false, 
          error: 'Instância já está conectada ao WhatsApp',
          connected: true
        };
      }
      
      // Usar connect endpoint que retorna QR code diretamente
      try {
        const connectResponse = await this.makeRequest('GET', `/instance/connect/${instanceName}`);
        
        console.log('Resposta connect:', connectResponse.data);
        
        // Na v2.2.2, o connect retorna QR code nos campos base64 ou code
        if (connectResponse.data?.base64) {
          return { 
            success: true, 
            data: {
              qrcode: connectResponse.data.base64,
              base64: connectResponse.data.base64
            }
          };
        }
        
        if (connectResponse.data?.code) {
          return { 
            success: true, 
            data: {
              qrcode: connectResponse.data.code,
              base64: connectResponse.data.code,
              pairingCode: connectResponse.data.pairingCode
            }
          };
        }
        
        // Se não encontrou QR code na resposta
        return { 
          success: false, 
          error: 'QR Code não disponível na resposta da API. Instância pode já estar conectada.'
        };
        
      } catch (connectError) {
        console.log('Erro ao conectar:', connectError.response?.data);
        return { 
          success: false, 
          error: connectError.response?.data?.message || connectError.message 
        };
      }
      
    } catch (error) {
      console.log('Erro geral QR Code:', error.response?.data);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Listar todas as instâncias
  async listInstances() {
    try {
      const response = await this.makeRequest('GET', '/instance/fetchInstances');
      console.log('Raw instances response:', JSON.stringify(response.data, null, 2));
      
      // Processar dados das instâncias para garantir formato consistente
      let instances = response.data;
      if (Array.isArray(instances)) {
        instances = instances.map(instance => ({
          instanceName: instance.instance?.instanceName || instance.instanceName || instance.name,
          connectionStatus: instance.instance?.state || instance.state || instance.connectionStatus || 'unknown',
          profilePicUrl: instance.instance?.profilePicUrl || instance.profilePicUrl,
          serverUrl: instance.instance?.serverUrl || instance.serverUrl,
          owner: instance.instance?.owner || instance.owner
        }));
      }
      
      console.log('Processed instances:', JSON.stringify(instances, null, 2));
      return { success: true, data: instances };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Status da instância
  async getInstanceStatus(instanceName) {
    try {
      const response = await this.makeRequest('GET', `/instance/connectionState/${instanceName}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Deletar instância
  async deleteInstance(instanceName) {
    try {
      const response = await this.makeRequest('DELETE', `/instance/delete/${instanceName}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Buscar grupos - baseado na documentação v2.2.2
  async getGroups(instanceName) {
    try {
      // Tentar primeiro o endpoint específico de grupos
      try {
        const response = await this.makeRequest('GET', `/group/fetchAllGroups/${instanceName}?getParticipants=false`);
        console.log('Resposta fetchAllGroups:', JSON.stringify(response.data, null, 2));

        if (!response.data || !Array.isArray(response.data)) {
          return [];
        }

        return response.data.map(group => ({
          id: group.id,
          name: group.subject || group.name || group.id.split('@')[0],
          participants: group.size || group.participantsCount || 0,
          image: group.pictureUrl || group.profilePicUrl || null,
          description: group.desc || group.description || '',
          createdAt: group.creation || group.createdAt || null,
          owner: group.owner || null
        }));
      } catch (groupError) {
        console.log('Erro no endpoint groups, tentando chats:', groupError.response?.data);
        
        // Fallback: tentar o endpoint de chats com POST
        try {
          const response = await this.makeRequest('POST', `/chat/findChats/${instanceName}`, {
            where: {
              key: {
                fromMe: false
              }
            }
          });
          
          console.log('Resposta findChats POST:', JSON.stringify(response.data, null, 2));

          if (!response.data || !Array.isArray(response.data)) {
            return [];
          }

          // Filtrar apenas grupos (que terminam com @g.us)
          const groups = response.data.filter(chat => 
            chat.remoteJid && chat.remoteJid.includes('@g.us')
          );
          
          return groups.map(group => ({
            id: group.remoteJid,
            name: group.pushName || group.name || group.remoteJid.split('@')[0],
            participants: group.participantsCount || 0,
            image: group.profilePicUrl || null,
            description: group.description || '',
            createdAt: group.updatedAt || group.createdAt || null,
            owner: group.owner || null
          }));
        } catch (chatError) {
          console.log('Erro no endpoint chats POST:', chatError.response?.data);
          
          // Último fallback: tentar endpoint de chats simples
          try {
            const response = await this.makeRequest('GET', `/chat/findChats/${instanceName}`);
            console.log('Resposta findChats GET:', JSON.stringify(response.data, null, 2));

            if (!response.data || !Array.isArray(response.data)) {
              return [];
            }

            const groups = response.data.filter(chat => 
              (chat.remoteJid && chat.remoteJid.includes('@g.us')) || 
              (chat.id && chat.id.includes('@g.us'))
            );
            
            return groups.map(group => ({
              id: group.remoteJid || group.id,
              name: group.pushName || group.name || (group.remoteJid || group.id).split('@')[0],
              participants: group.participantsCount || 0,
              image: group.profilePicUrl || null,
              description: group.description || '',
              createdAt: group.updatedAt || group.createdAt || null,
              owner: group.owner || null
            }));
          } catch (finalError) {
            console.error('Todos os endpoints de grupos falharam:', finalError.response?.data);
            return [];
          }
        }
      }
    } catch (error) {
      console.error('Erro geral ao buscar grupos:', error);
      return [];
    }
  }

  // Enviar mensagem de texto - baseado na documentação v2.2.2
  async sendTextMessage(instanceName, number, text) {
    try {
      const payload = {
        number: number,
        text: text,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false
        }
      };

      console.log(`📤 Enviando mensagem de texto para ${number} via instância ${instanceName}`);
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await this.makeRequest('POST', `/message/sendText/${instanceName}`, payload);

      console.log(`✅ Mensagem enviada com sucesso:`, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.log(`❌ Erro ao enviar mensagem:`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Função para converter arquivo para base64
  async convertFileToBase64(filePath) {
    try {
      // Se for uma URL, tentar baixar o arquivo
      if (filePath.startsWith('http')) {
        const response = await axios.get(filePath, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        return buffer.toString('base64');
      }
      
      // Se for um caminho local, ler o arquivo
      const fullPath = path.join(__dirname, '../../uploads', path.basename(filePath));
      const fileBuffer = fs.readFileSync(fullPath);
      return fileBuffer.toString('base64');
    } catch (error) {
      console.error('Erro ao converter arquivo para base64:', error);
      throw error;
    }
  }

  // Enviar mídia - baseado na documentação v2.2.2
  async sendMediaMessage(instanceName, number, mediaUrl, caption = '', mediaType = 'image') {
    try {
      let mediaData = mediaUrl;
      
      // Se a URL for localhost, converter para base64
      if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1')) {
        console.log(`🔄 Convertendo arquivo local para base64: ${mediaUrl}`);
        mediaData = await this.convertFileToBase64(mediaUrl);
        console.log(`✅ Arquivo convertido para base64 (${mediaData.length} caracteres)`);
      }

      const payload = {
        number: number,
        mediatype: mediaType, // image, video, audio, document
        media: mediaData,
        caption: caption,
        options: {
          delay: 1200,
          presence: "composing"
        }
      };

      console.log(`📤 Enviando mídia (${mediaType}) para ${number} via instância ${instanceName}`);
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await this.makeRequest('POST', `/message/sendMedia/${instanceName}`, payload);

      console.log(`✅ Mídia enviada com sucesso:`, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.log(`❌ Erro ao enviar mídia:`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Método genérico para enviar mensagens
  async sendMessage(instanceName, number, message, mediaPath = null, messageType = 'TEXT') {
    try {
      if (messageType === 'TEXT' || !mediaPath) {
        return await this.sendTextMessage(instanceName, number, message);
      } else {
        // Mapear tipos de mensagem para tipos de mídia
        let mediaType = 'document';
        if (messageType === 'IMAGE') {
          mediaType = 'image';
        } else if (messageType === 'VIDEO') {
          mediaType = 'video';
        } else if (messageType === 'AUDIO') {
          mediaType = 'audio';
        }
        
        console.log(`📤 Enviando ${messageType} (${mediaType}) via ${instanceName}`);
        return await this.sendMediaMessage(instanceName, number, mediaPath, message, mediaType);
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Logout da instância
  async logoutInstance(instanceName) {
    try {
      const response = await this.makeRequest('DELETE', `/instance/logout/${instanceName}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Restart da instância
  async restartInstance(instanceName) {
    try {
      const response = await this.makeRequest('PUT', `/instance/restart/${instanceName}`, {});
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }
}

module.exports = new EvolutionApiService();