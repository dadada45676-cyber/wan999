-- SMS营销数据分析系统 - 存储桶配置
-- 文件上传和存储功能配置

-- 1. 创建存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
-- 号码包文件存储桶
('phone-packages', 'phone-packages', false, 52428800, ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']),
-- 报告文件存储桶
('reports', 'reports', false, 104857600, ARRAY['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
-- 用户头像存储桶
('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
-- 系统文档存储桶
('documents', 'documents', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);

-- 2. 创建存储桶的RLS策略

-- phone-packages 存储桶策略
CREATE POLICY "phone_packages_upload_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'phone-packages' AND 
        (get_current_user_role() = 'admin' OR get_current_user_role() = 'operator')
    );

CREATE POLICY "phone_packages_select_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'phone-packages' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

CREATE POLICY "phone_packages_update_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'phone-packages' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    )
    WITH CHECK (
        bucket_id = 'phone-packages' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

CREATE POLICY "phone_packages_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'phone-packages' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

-- reports 存储桶策略
CREATE POLICY "reports_upload_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'reports' AND 
        (get_current_user_role() = 'admin' OR get_current_user_role() = 'operator')
    );

CREATE POLICY "reports_select_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reports' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

CREATE POLICY "reports_update_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'reports' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    )
    WITH CHECK (
        bucket_id = 'reports' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

CREATE POLICY "reports_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'reports' AND 
        (get_current_user_role() = 'admin' OR 
         (storage.foldername(name))[1] = auth.uid()::text)
    );

-- avatars 存储桶策略（公开读取，用户只能管理自己的头像）
CREATE POLICY "avatars_upload_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "avatars_select_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'avatars');

CREATE POLICY "avatars_update_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'avatars' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "avatars_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- documents 存储桶策略（只有管理员可以管理）
CREATE POLICY "documents_upload_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents' AND 
        get_current_user_role() = 'admin'
    );

CREATE POLICY "documents_select_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents');

CREATE POLICY "documents_update_policy" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'documents' AND 
        get_current_user_role() = 'admin'
    )
    WITH CHECK (
        bucket_id = 'documents' AND 
        get_current_user_role() = 'admin'
    );

CREATE POLICY "documents_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents' AND 
        get_current_user_role() = 'admin'
    );

-- 3. 创建文件管理相关的数据库表
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed', 'processing')),
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为文件上传表启用RLS
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- 文件上传表的RLS策略
CREATE POLICY "file_uploads_select_policy" ON file_uploads
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "file_uploads_insert_policy" ON file_uploads
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND 
        get_current_user_role() IN ('admin', 'operator')
    );

CREATE POLICY "file_uploads_update_policy" ON file_uploads
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "file_uploads_delete_policy" ON file_uploads
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

-- 创建文件上传表的索引
CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_bucket ON file_uploads(bucket_name);
CREATE INDEX idx_file_uploads_status ON file_uploads(upload_status);
CREATE INDEX idx_file_uploads_created ON file_uploads(created_at);

-- 为文件上传表添加更新时间戳触发器
CREATE TRIGGER update_file_uploads_updated_at 
    BEFORE UPDATE ON file_uploads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. 创建文件处理相关的函数
-- 获取文件的公开URL
CREATE OR REPLACE FUNCTION get_file_public_url(bucket_name TEXT, file_path TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN format('%s/storage/v1/object/public/%s/%s', 
                   current_setting('app.supabase_url'), 
                   bucket_name, 
                   file_path);
END;
$$ LANGUAGE plpgsql;

-- 获取文件的签名URL（用于私有文件）
CREATE OR REPLACE FUNCTION get_file_signed_url(bucket_name TEXT, file_path TEXT, expires_in INTEGER DEFAULT 3600)
RETURNS TEXT AS $$
BEGIN
    -- 这里返回一个占位符，实际的签名URL需要在应用层生成
    RETURN format('signed_url_for_%s_%s_expires_%s', bucket_name, file_path, expires_in);
END;
$$ LANGUAGE plpgsql;

-- 清理过期的文件上传记录
CREATE OR REPLACE FUNCTION cleanup_expired_uploads()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除7天前失败的上传记录
    DELETE FROM file_uploads 
    WHERE upload_status = 'failed' 
    AND created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建定期清理任务（需要pg_cron扩展）
-- 注意：这个需要在Supabase控制台中手动启用pg_cron扩展
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-expired-uploads', '0 2 * * *', 'SELECT cleanup_expired_uploads();');

-- 6. 授予存储相关权限
GRANT ALL PRIVILEGES ON file_uploads TO authenticated;
GRANT EXECUTE ON FUNCTION get_file_public_url(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_file_signed_url(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_uploads() TO authenticated;