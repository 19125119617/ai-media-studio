/**
 * 阿里云百炼 API 适配器
 * 负责将通用调用格式转换为百炼 API 格式
 */

const axios = require('axios');

/**
 * 文本生成图片
 * @param {string} apiKey - 百炼 API Key
 * @param {string} modelId - 模型 ID（如 wan2.7-image）
 * @param {object} params - { prompt, aspectRatio, n }
 * @returns {object} - { requestBody, headers, taskUrl }
 */
function textToImage(apiKey, modelId, { prompt, aspectRatio = '1:1', n = 1 }) {
  const sizeMap = {
    '1:1': '1024*1024', '9:16': '864*1536', '16:9': '1536*864',
    '3:4': '896*1152', '4:3': '1152*896', '2:3': '832*1216', '3:2': '1216*832'
  };
  return {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    requestBody: {
      model: modelId,
      input: { prompt },
      parameters: {
        size: sizeMap[aspectRatio] || '1024*1024',
        n: parseInt(n),
        style: '<auto>'
      }
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    }
  };
}

/**
 * 文本生成视频
 * @param {string} apiKey - 百炼 API Key
 * @param {string} modelId - 模型 ID
 * @param {object} params - { prompt, duration, resolution }
 * @returns {object} - { url, requestBody, headers }
 */
function textToVideo(apiKey, modelId, { prompt, duration = 5, resolution = '720P' }) {
  return {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    requestBody: {
      model: 'wan2.7-t2v',
      input: { text: prompt },
      parameters: { duration: parseInt(duration), resolution }
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    }
  };
}

/**
 * 图片生成视频
 * @param {string} apiKey - 百炼 API Key
 * @param {string} modelId - 模型 ID
 * @param {object} params - { imageBase64, prompt, duration, resolution }
 * @returns {object} - { url, requestBody, headers }
 */
function imageToVideo(apiKey, modelId, { imageBase64, prompt = '', duration = 5, resolution = '720P' }) {
  const imgUrl = `data:image/jpeg;base64,${imageBase64}`;
  return {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    requestBody: {
      model: 'wan2.7-i2v',
      input: { image_url: imgUrl, text: prompt },
      parameters: { duration: parseInt(duration), resolution }
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    }
  };
}

/**
 * 轮询任务状态
 * @param {string} apiKey
 * @param {string} taskId - 百炼返回的 task_id
 * @param {number} maxWaitSeconds
 * @returns {function} - (taskRecord) => Promise<void>
 */
function createPoller(apiKey, taskId, maxWaitSeconds) {
  return async (taskRecord) => {
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    const interval = 4000;
    const maxAttempts = Math.floor((maxWaitSeconds * 1000) / interval);
    const axiosInst = axios.create({ headers: { 'Authorization': `Bearer ${apiKey}` } });

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, interval));
      try {
        const resp = await axiosInst.get(url);
        const output = resp.data.output;
        const status = output?.task_status;
        if (status === 'SUCCEEDED') {
          taskRecord.status = 'succeeded';
          if (output.results) {
            taskRecord.result = output.results.map(r => r.url || r.video_url).filter(Boolean);
          } else if (output.video_url) {
            taskRecord.result = [output.video_url];
          } else if (output.result_url) {
            taskRecord.result = [output.result_url];
          }
          return;
        } else if (status === 'FAILED') {
          taskRecord.status = 'failed';
          taskRecord.error = output.message || '生成失败';
          return;
        }
      } catch {}
    }
    taskRecord.status = 'failed';
    taskRecord.error = '生成超时，请重试';
  };
}

module.exports = { textToImage, textToVideo, imageToVideo, createPoller };
