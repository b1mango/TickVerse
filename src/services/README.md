# services

领域服务层：taskService / timelineService / statsService / aiService / syncService / rolloverService。纯函数为主，副作用集中在 db 与 adapters，可单测（§5.3）。
