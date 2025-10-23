# Supabase数据库结构设计

## 概述

本文档定义了SMS营销数据分析系统在Supabase中的完整数据库结构，包括表设计、索引、RLS策略和初始数据。

## 数据库表结构

### 1. 用户认证表 (auth.users)

Supabase内置的用户认证表，无需手动创建。主要字段：
- `id`: UUID主键
- `email`: 用户邮箱
- `created_at`: 创建时间
- `updated_at`: 更新时间

### 2. 用户配置表 (user_profiles)

```sql
-- 用户配置表
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'inactive')),
    permissions JSONB DEFAULT '[]',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 索引
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
```

### 3. 号码包表 (phone_packages)

```sql
-- 号码包表
CREATE TABLE phone_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(10) NOT NULL DEFAULT 'BR',
    phone_count INTEGER NOT NULL DEFAULT 0,
    first_charge_count INTEGER NOT NULL DEFAULT 0,
    conversion_rate DECIMAL(10,4) DEFAULT 0,
    package_grade VARCHAR(5) DEFAULT 'D',
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_url TEXT,
    file_size BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'processing', 'inactive')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_phone_packages_country ON phone_packages(country);
CREATE INDEX idx_phone_packages_grade ON phone_packages(package_grade);
CREATE INDEX idx_phone_packages_status ON phone_packages(status);
CREATE INDEX idx_phone_packages_created_by ON phone_packages(created_by);
CREATE INDEX idx_phone_packages_upload_time ON phone_packages(upload_time DESC);
```

### 4. 号码评级表 (phone_ratings)

```sql
-- 号码评级表
CREATE TABLE phone_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    package_id UUID REFERENCES phone_packages(id) ON DELETE CASCADE,
    country VARCHAR(10) NOT NULL DEFAULT 'BR',
    rating VARCHAR(20) NOT NULL CHECK (rating IN ('excellent', 'good', 'average', 'poor', 'very_poor')),
    rating_score INTEGER NOT NULL DEFAULT 0,
    package_size INTEGER DEFAULT 0,
    notes TEXT,
    rated_by UUID REFERENCES auth.users(id),
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_phone_ratings_phone_number ON phone_ratings(phone_number);
CREATE INDEX idx_phone_ratings_package_id ON phone_ratings(package_id);
CREATE INDEX idx_phone_ratings_country ON phone_ratings(country);
CREATE INDEX idx_phone_ratings_rating ON phone_ratings(rating);
CREATE INDEX idx_phone_ratings_rated_at ON phone_ratings(rated_at DESC);
CREATE INDEX idx_phone_ratings_rated_by ON phone_ratings(rated_by);
```

### 5. 号码综合评分表 (phone_scores)

```sql
-- 号码综合评分表
CREATE TABLE phone_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    country VARCHAR(10) NOT NULL DEFAULT 'BR',
    rating_count INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    final_grade VARCHAR(5) DEFAULT 'E',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'rating', 'active')),
    algorithm VARCHAR(20) DEFAULT 'weighted',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_phone_scores_phone_number ON phone_scores(phone_number);
CREATE INDEX idx_phone_scores_country ON phone_scores(country);
CREATE INDEX idx_phone_scores_final_grade ON phone_scores(final_grade);
CREATE INDEX idx_phone_scores_status ON phone_scores(status);
CREATE INDEX idx_phone_scores_last_updated ON phone_scores(last_updated DESC);
```

### 6. 报告表 (reports)

```sql
-- 报告表
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
    format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
    status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    data_range_start DATE NOT NULL,
    data_range_end DATE NOT NULL,
    country VARCHAR(10) DEFAULT 'BR',
    package_ids JSONB DEFAULT '[]',
    include_charts BOOLEAN DEFAULT true,
    include_details BOOLEAN DEFAULT true,
    file_url TEXT,
    file_size BIGINT DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_country ON reports(country);
CREATE INDEX idx_reports_generated_by ON reports(generated_by);
CREATE INDEX idx_reports_generated_at ON reports(generated_at DESC);
CREATE INDEX idx_reports_data_range ON reports(data_range_start, data_range_end);
```

### 7. 系统设置表 (system_settings)

```sql
-- 系统设置表
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    package_grade_thresholds JSONB DEFAULT '{"SS": 50, "S": 30, "A": 20, "B": 16, "C": 10, "D": 0}',
    break_even_config JSONB DEFAULT '{"threshold": 16, "warningLine": 12.8, "dangerLine": 9.6, "unit": "万条", "description": "16个首充/万条号码"}',
    final_grade_config JSONB DEFAULT '[
        {"name": "A", "minScore": 8, "color": "#10B981", "description": "优质号码"},
        {"name": "B", "minScore": 6, "color": "#3B82F6", "description": "良好号码"},
        {"name": "C", "minScore": 4, "color": "#F59E0B", "description": "一般号码"},
        {"name": "D", "minScore": 2, "color": "#EF4444", "description": "较差号码"},
        {"name": "E", "minScore": 0, "color": "#6B7280", "description": "差号码"}
    ]',
    scoring_algorithm VARCHAR(20) DEFAULT 'weighted',
    min_rating_count INTEGER DEFAULT 3,
    time_decay_factor DECIMAL(5,3) DEFAULT 0.01,
    rating_score_map JSONB DEFAULT '{"excellent": 10, "good": 8, "average": 6, "poor": 4, "very_poor": 2}',
    country_options JSONB DEFAULT '[
        {"value": "BR", "label": "巴西", "flag": "🇧🇷"},
        {"value": "MX", "label": "墨西哥", "flag": "🇲🇽"},
        {"value": "AR", "label": "阿根廷", "flag": "🇦🇷"},
        {"value": "CO", "label": "哥伦比亚", "flag": "🇨🇴"},
        {"value": "PE", "label": "秘鲁", "flag": "🇵🇪"}
    ]',
    rating_options JSONB DEFAULT '[
        {"value": "excellent", "label": "优秀", "color": "#10B981", "score": 10},
        {"value": "good", "label": "良好", "color": "#3B82F6", "score": 8},
        {"value": "average", "label": "一般", "color": "#F59E0B", "score": 6},
        {"value": "poor", "label": "较差", "color": "#EF4444", "score": 4},
        {"value": "very_poor", "label": "很差", "color": "#6B7280", "score": 2}
    ]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_settings_row CHECK (id = 1)
);
```

### 8. 审计日志表 (audit_logs)

```sql
-- 审计日志表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

## Row Level Security (RLS) 策略

### 1. 用户配置表 RLS

```sql
-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的配置
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有用户配置
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 用户可以更新自己的配置
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- 管理员可以管理所有用户
CREATE POLICY "Admins can manage all profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 2. 号码包表 RLS

```sql
-- 启用RLS
ALTER TABLE phone_packages ENABLE ROW LEVEL SECURITY;

-- 认证用户可以查看所有号码包
CREATE POLICY "Authenticated users can view packages" ON phone_packages
    FOR SELECT USING (auth.role() = 'authenticated');

-- 认证用户可以创建号码包
CREATE POLICY "Authenticated users can create packages" ON phone_packages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 用户可以更新自己创建的号码包，管理员可以更新所有
CREATE POLICY "Users can update own packages or admins can update all" ON phone_packages
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员可以删除号码包
CREATE POLICY "Admins can delete packages" ON phone_packages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 3. 号码评级表 RLS

```sql
-- 启用RLS
ALTER TABLE phone_ratings ENABLE ROW LEVEL SECURITY;

-- 认证用户可以查看所有评级
CREATE POLICY "Authenticated users can view ratings" ON phone_ratings
    FOR SELECT USING (auth.role() = 'authenticated');

-- 认证用户可以创建评级
CREATE POLICY "Authenticated users can create ratings" ON phone_ratings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 用户可以更新自己的评级，管理员可以更新所有
CREATE POLICY "Users can update own ratings or admins can update all" ON phone_ratings
    FOR UPDATE USING (
        rated_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 4. 号码综合评分表 RLS

```sql
-- 启用RLS
ALTER TABLE phone_scores ENABLE ROW LEVEL SECURITY;

-- 认证用户可以查看所有评分
CREATE POLICY "Authenticated users can view scores" ON phone_scores
    FOR SELECT USING (auth.role() = 'authenticated');

-- 认证用户可以创建和更新评分
CREATE POLICY "Authenticated users can manage scores" ON phone_scores
    FOR ALL USING (auth.role() = 'authenticated');
```

### 5. 报告表 RLS

```sql
-- 启用RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 认证用户可以查看所有报告
CREATE POLICY "Authenticated users can view reports" ON reports
    FOR SELECT USING (auth.role() = 'authenticated');

-- 认证用户可以创建报告
CREATE POLICY "Authenticated users can create reports" ON reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 用户可以更新自己生成的报告，管理员可以更新所有
CREATE POLICY "Users can update own reports or admins can update all" ON reports
    FOR UPDATE USING (
        generated_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员可以删除报告
CREATE POLICY "Admins can delete reports" ON reports
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 6. 系统设置表 RLS

```sql
-- 启用RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 认证用户可以查看系统设置
CREATE POLICY "Authenticated users can view settings" ON system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- 只有管理员可以更新系统设置
CREATE POLICY "Admins can update settings" ON system_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### 7. 审计日志表 RLS

```sql
-- 启用RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有审计日志
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 系统可以插入审计日志
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);
```

## 存储桶配置

### 1. 号码包文件存储

```sql
-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('packages', 'packages', false);

-- 存储策略
CREATE POLICY "Authenticated users can upload package files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'packages' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can view package files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'packages' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete own files or admins can delete all" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'packages' AND (
            owner = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() AND role = 'admin'
            )
        )
    );
```

### 2. 报告文件存储

```sql
-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- 存储策略
CREATE POLICY "System can manage report files" ON storage.objects
    FOR ALL USING (bucket_id = 'reports');
```

## 初始数据

### 1. 默认系统设置

```sql
-- 插入默认系统设置
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

### 2. 创建默认管理员用户触发器

```sql
-- 创建用户配置触发器函数
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        CASE 
            WHEN NEW.email = 'admin@example.com' THEN 'admin'
            ELSE 'operator'
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();
```

## 数据库函数

### 1. 更新时间戳函数

```sql
-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表创建触发器
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_packages_updated_at
    BEFORE UPDATE ON phone_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. 号码评分计算函数

```sql
-- 创建号码评分计算函数
CREATE OR REPLACE FUNCTION calculate_phone_score(p_phone_number VARCHAR)
RETURNS VOID AS $$
DECLARE
    v_ratings RECORD;
    v_settings RECORD;
    v_average_score DECIMAL(5,2) := 0;
    v_rating_count INTEGER := 0;
    v_final_grade VARCHAR(5) := 'E';
BEGIN
    -- 获取系统设置
    SELECT * INTO v_settings FROM system_settings WHERE id = 1;
    
    -- 获取该号码的评级统计
    SELECT 
        COUNT(*) as rating_count,
        AVG(rating_score) as avg_score
    INTO v_ratings
    FROM phone_ratings 
    WHERE phone_number = p_phone_number;
    
    v_rating_count := COALESCE(v_ratings.rating_count, 0);
    v_average_score := COALESCE(v_ratings.avg_score, 0);
    
    -- 根据平均分确定最终等级
    IF v_average_score >= 8 THEN v_final_grade := 'A';
    ELSIF v_average_score >= 6 THEN v_final_grade := 'B';
    ELSIF v_average_score >= 4 THEN v_final_grade := 'C';
    ELSIF v_average_score >= 2 THEN v_final_grade := 'D';
    ELSE v_final_grade := 'E';
    END IF;
    
    -- 更新或插入评分记录
    INSERT INTO phone_scores (
        phone_number, 
        rating_count, 
        average_score, 
        final_grade,
        status,
        last_updated
    ) VALUES (
        p_phone_number,
        v_rating_count,
        v_average_score,
        v_final_grade,
        CASE WHEN v_rating_count >= COALESCE(v_settings.min_rating_count, 3) THEN 'active' ELSE 'rating' END,
        NOW()
    )
    ON CONFLICT (phone_number) 
    DO UPDATE SET
        rating_count = EXCLUDED.rating_count,
        average_score = EXCLUDED.average_score,
        final_grade = EXCLUDED.final_grade,
        status = EXCLUDED.status,
        last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;
```

### 3. 评级后自动计算评分触发器

```sql
-- 创建评级后自动计算评分的触发器
CREATE OR REPLACE FUNCTION trigger_calculate_phone_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 计算新评级的号码评分
    PERFORM calculate_phone_score(NEW.phone_number);
    
    -- 如果是更新操作且号码变了，也要计算旧号码的评分
    IF TG_OP = 'UPDATE' AND OLD.phone_number != NEW.phone_number THEN
        PERFORM calculate_phone_score(OLD.phone_number);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER after_phone_rating_change
    AFTER INSERT OR UPDATE ON phone_ratings
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_phone_score();
```

## 部署说明

1. **按顺序执行DDL语句**：先创建表，再创建索引，最后创建RLS策略
2. **配置存储桶**：在Supabase控制台中创建存储桶并配置策略
3. **设置环境变量**：确保应用中的Supabase配置正确
4. **测试连接**：验证所有API服务能正常连接数据库
5. **初始化数据**：运行初始数据插入脚本

## 维护建议

1. **定期备份**：设置自动备份策略
2. **监控性能**：关注查询性能和索引使用情况
3. **清理日志**：定期清理过期的审计日志
4. **更新统计**：定期更新数据库统计信息
5. **安全审计**：定期检查RLS策略和权限设置