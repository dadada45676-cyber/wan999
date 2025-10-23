-- SMS营销数据分析系统 - 数据库初始化脚本
-- 基于实际TypeScript接口生成，确保100%兼容

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. 国家配置表
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE, -- 国家代码，如 'BR', 'MX', 'BD'
  name VARCHAR(100) NOT NULL, -- 国家名称
  flag VARCHAR(10) NOT NULL, -- 国旗emoji
  phone_prefix VARCHAR(10) NOT NULL, -- 电话前缀
  phone_length INTEGER[] NOT NULL, -- 允许的号码长度数组
  mobile_pattern VARCHAR(255), -- 手机号码正则表达式
  example_number VARCHAR(20), -- 示例号码
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 用户表（基于auth.ts接口）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
  permissions TEXT[] DEFAULT '{}', -- 权限数组
  last_login TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 3. 号码包表（基于store/index.ts的PhonePackage接口）
CREATE TABLE phone_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  send_time TIMESTAMP WITH TIME ZONE NOT NULL,
  phone_count INTEGER NOT NULL DEFAULT 0,
  valid_phones INTEGER DEFAULT 0,
  invalid_phones INTEGER DEFAULT 0,
  duplicate_phones INTEGER DEFAULT 0,
  first_charge_count INTEGER NOT NULL DEFAULT 0,
  conversion_rate DECIMAL(10,4) NOT NULL DEFAULT 0, -- 万分转化数
  grade VARCHAR(2) NOT NULL CHECK (grade IN ('SS', 'S', 'A', 'B', 'C', 'D')),
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  upload_progress INTEGER DEFAULT 0,
  sms_provider VARCHAR(100) NOT NULL,
  source VARCHAR(100) NOT NULL,
  game_platform VARCHAR(100) NOT NULL,
  country_code VARCHAR(3) NOT NULL REFERENCES countries(code),
  description TEXT,
  visit_count INTEGER DEFAULT 0,
  register_count INTEGER DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 号码表
CREATE TABLE phones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) NOT NULL,
  package_id UUID NOT NULL REFERENCES phone_packages(id) ON DELETE CASCADE,
  country_code VARCHAR(3) NOT NULL REFERENCES countries(code),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rating', 'active')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, country_code)
);

-- 5. 号码评级历史表（基于PhoneRating接口）
CREATE TABLE phone_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) NOT NULL,
  package_id UUID NOT NULL REFERENCES phone_packages(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  rating VARCHAR(2) NOT NULL CHECK (rating IN ('SS', 'S', 'A', 'B', 'C', 'D')),
  rating_score INTEGER NOT NULL, -- 评级对应分数
  package_size INTEGER NOT NULL, -- 包规模，用于加权计算
  country_code VARCHAR(3) NOT NULL REFERENCES countries(code),
  rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 号码综合评分表（基于PhoneScore接口）
CREATE TABLE phone_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) NOT NULL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  average_score DECIMAL(8,4) NOT NULL DEFAULT 0,
  weighted_score DECIMAL(8,4) DEFAULT 0,
  time_decay_score DECIMAL(8,4) DEFAULT 0,
  final_grade VARCHAR(1) NOT NULL CHECK (final_grade IN ('A', 'B', 'C', 'D', 'E')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rating', 'active')),
  algorithm_type VARCHAR(20) NOT NULL DEFAULT 'weighted' CHECK (algorithm_type IN ('simple', 'weighted', 'timeDecay')),
  country_code VARCHAR(3) NOT NULL REFERENCES countries(code),
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, country_code)
);

-- 7. 报告表（基于Report接口）
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
  format VARCHAR(10) DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv')),
  status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_period VARCHAR(100),
  file_size VARCHAR(20),
  download_count INTEGER DEFAULT 0,
  description TEXT,
  data JSONB, -- 存储报告数据
  download_url TEXT,
  country_code VARCHAR(3) NOT NULL REFERENCES countries(code),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 系统设置表（基于SystemSettings接口）
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 审计日志表（基于AuditLog接口）
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure')),
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. 用户会话表（基于SessionInfo接口）
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX idx_phone_packages_country ON phone_packages(country_code);
CREATE INDEX idx_phone_packages_status ON phone_packages(status);
CREATE INDEX idx_phone_packages_user ON phone_packages(user_id);
CREATE INDEX idx_phone_packages_send_time ON phone_packages(send_time);

CREATE INDEX idx_phones_package ON phones(package_id);
CREATE INDEX idx_phones_country ON phones(country_code);
CREATE INDEX idx_phones_status ON phones(status);
CREATE INDEX idx_phones_number ON phones(phone_number);

CREATE INDEX idx_phone_ratings_phone ON phone_ratings(phone_number);
CREATE INDEX idx_phone_ratings_package ON phone_ratings(package_id);
CREATE INDEX idx_phone_ratings_country ON phone_ratings(country_code);
CREATE INDEX idx_phone_ratings_rated_at ON phone_ratings(rated_at);

CREATE INDEX idx_phone_scores_phone ON phone_scores(phone_number);
CREATE INDEX idx_phone_scores_country ON phone_scores(country_code);
CREATE INDEX idx_phone_scores_grade ON phone_scores(final_grade);
CREATE INDEX idx_phone_scores_status ON phone_scores(status);

CREATE INDEX idx_reports_country ON reports(country_code);
CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_status ON reports(status);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加更新时间戳触发器
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_packages_updated_at BEFORE UPDATE ON phone_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phones_updated_at BEFORE UPDATE ON phones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_ratings_updated_at BEFORE UPDATE ON phone_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_scores_updated_at BEFORE UPDATE ON phone_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建计算转化率的函数
CREATE OR REPLACE FUNCTION calculate_conversion_rate(first_charge_count INTEGER, phone_count INTEGER)
RETURNS DECIMAL(10,4) AS $$
BEGIN
    IF phone_count = 0 THEN
        RETURN 0;
    END IF;
    RETURN (first_charge_count::DECIMAL / phone_count::DECIMAL) * 10000;
END;
$$ LANGUAGE plpgsql;

-- 创建获取号码包评级的函数
CREATE OR REPLACE FUNCTION get_package_grade(conversion_rate DECIMAL)
RETURNS VARCHAR(2) AS $$
BEGIN
    IF conversion_rate >= 50 THEN RETURN 'SS';
    ELSIF conversion_rate >= 30 THEN RETURN 'S';
    ELSIF conversion_rate >= 20 THEN RETURN 'A';
    ELSIF conversion_rate >= 16 THEN RETURN 'B';
    ELSIF conversion_rate >= 10 THEN RETURN 'C';
    ELSE RETURN 'D';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 创建获取最终分档的函数
CREATE OR REPLACE FUNCTION get_final_grade(average_score DECIMAL)
RETURNS VARCHAR(1) AS $$
BEGIN
    IF average_score >= 80 THEN RETURN 'A';
    ELSIF average_score >= 60 THEN RETURN 'B';
    ELSIF average_score >= 40 THEN RETURN 'C';
    ELSIF average_score >= 20 THEN RETURN 'D';
    ELSE RETURN 'E';
    END IF;
END;
$$ LANGUAGE plpgsql;