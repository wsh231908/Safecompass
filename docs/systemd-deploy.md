# SafeCompass systemd 部署说明

当前服务器适合使用系统级 systemd 服务管理 SafeCompass 和本地 Llama。仓库已经提供 unit 文件：

```text
deploy/systemd/safecompass.service
deploy/systemd/safecompass-llama.service
```

## 服务地址

| 服务 | 地址 | systemd unit |
| --- | --- | --- |
| SafeCompass 平台 | `http://127.0.0.1:4173` | `safecompass.service` |
| Llama vLLM API | `http://127.0.0.1:8002/v1` | `safecompass-llama.service` |

## 安装

需要 root 权限：

```bash
cd /home/u2023202105/Safecompass
sudo scripts/install_systemd_services.sh install
sudo scripts/install_systemd_services.sh start
```

安装脚本会：

- 复制 unit 文件到 `/etc/systemd/system/`
- 创建可选覆盖文件 `/etc/safecompass/safecompass.env` 和 `/etc/safecompass/llama.env`
- 执行 `systemctl daemon-reload`
- 执行 `systemctl enable safecompass-llama.service safecompass.service`
- 启动前停止旧的 tmux 会话 `safecompass_local` 和 `llama70b_awq_judge`

## 常用命令

```bash
sudo systemctl status safecompass.service safecompass-llama.service
sudo systemctl restart safecompass.service
sudo systemctl restart safecompass-llama.service
sudo journalctl -u safecompass.service -f
sudo journalctl -u safecompass-llama.service -f
```

也可以通过脚本操作：

```bash
sudo scripts/install_systemd_services.sh status
sudo scripts/install_systemd_services.sh restart
sudo scripts/install_systemd_services.sh stop
sudo scripts/install_systemd_services.sh uninstall
```

## 配置覆盖

修改 Llama 使用的 GPU 或显存比例：

```bash
sudo vim /etc/safecompass/llama.env
sudo systemctl restart safecompass-llama.service
```

当前默认值与已验证的手动启动配置一致：

```text
GPU_ID=0
JUDGE_PORT=8002
MAX_MODEL_LEN=2048
MAX_NUM_SEQS=1
GPU_MEMORY_UTILIZATION=0.75
QUANTIZATION=awq_marlin
```

如果服务器空闲且需要更大 KV cache，可尝试把 `GPU_MEMORY_UTILIZATION` 调高到 `0.90`；如果出现 OOM，降低该值或降低 `MAX_MODEL_LEN`。

## 验证

```bash
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1:8002/v1/models
```

正常情况下：

- SafeCompass 返回 `{"ok":true}`
- Llama 模型列表包含 `meta-llama/Llama-3-70b-chat-hf`
