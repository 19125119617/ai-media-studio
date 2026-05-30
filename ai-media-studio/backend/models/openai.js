/**
 * OpenAI API 适配器（预留）
 * 未来接入 DALL-E / Sora 等模型时使用
 */

const axios = require('axios');

/**
 * 文本生成图片（OpenAI 格式）
 */
function textToImage(apiKey, modelId, { prompt, size = '1024x1024', n = 1 }) {
  return {
    url: 'https://api.openai.com/v1/images/generations',
    requestBody: {
      model: modelId || 'dall-e-3',
      prompt,
      n: parseInt(n),
      size
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * 文本生成视频（Sora 等）
 */
function textToVideo(apiKey, modelId, { prompt, duration = 5 }) {
  // OpenAI Sora API 尚未完全开放，格式待定
  return {
    url: 'https://api.openai.com/v1/video/generations',
    requestBody: {
      model: modelId || 'sora-1',
      input: { prompt },
      duration: parseInt(duration)
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
}

function imageToVideo(apiKey, modelId, { imageUrl, prompt = '' }) {
  return {
    url: 'https://api.openai.com/v1/video/generations',
    requestBody: {
      model: modelId || 'sora-1',
      input: { image_url: imageUrl, text: prompt }
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * 轮询任务（OpenAI 使用不同的轮询机制）
 */
function createPoller(apiKey, runId, maxWaitSeconds) {
  return async (taskRecord) => {
    const interval = 5000;
    const maxAttempts = Math.floor((maxWaitSeconds * 1000) / interval);
    const axiosInst = axios.create({ headers: { 'Authorization': `Bearer ${apiKey}` } });

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, interval));
      try {
        const resp = await axiosInst.get(`https://api.openai.com/v1/runs/${runId}`);
        const status = resp.data.status;
        if (status === 'completed') {
          taskRecord.status = 'succeeded';
          taskRecord.result = [resp.data.output?.[0]?.url].filter(Boolean);
          return;
        } else if (status === 'failed') {
          taskRecord.status = 'failed';
          taskRecord.error = resp.data.error?.message || '生成失败';
          return;
        }
      } catch {}
    }
    taskRecord.status = 'failed';
    taskRecord.error = '生成超时，请重试';
  };
}

module.exports = { textToImage, textToVideo, imageToVideo, createPoller };
