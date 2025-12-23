
import React, { useState, useRef, useEffect } from 'react';
import { SystemSettings } from '../types';
import { Save, Upload, Camera, Building2, Layout, Loader2, FileText, CheckCircle, RefreshCcw, AlertTriangle, X, Terminal } from 'lucide-react';
import { supabase, uploadFile } from '../utils/supabase';

interface SystemSettingsPageProps {
  settings: SystemSettings;
  onUpdate: (settings: SystemSettings) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ settings, onUpdate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; code?: string } | null>(null);
  const [formData, setFormData] = useState({
    orgName: settings.orgName,
    appDescription: settings.appDescription,
    logoUrl: settings.logoUrl
  });

  useEffect(() => {
    setFormData({
      orgName: settings.orgName,
      appDescription: settings.appDescription,
      logoUrl: settings.logoUrl
    });
    setPreviewUrl(settings.logoUrl);
  }, [settings]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.logoUrl);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
          alert("File size too large. Max 2MB allowed.");
          return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSaveError(null);
    }
  };

  const handleSave = async () => {
    if (!formData.orgName.trim()) {
        alert("Organization name is required.");
        return;
    }

    setIsSaving(true);
    setIsSyncing(true);
    setSaveError(null);
    let finalLogoUrl = formData.logoUrl;

    try {
        if (selectedFile) {
            const uploadedUrl = await uploadFile(selectedFile, 'avatars');
            if (uploadedUrl) {
                finalLogoUrl = uploadedUrl;
            } else {
                throw new Error("Logo upload failed. Ensure 'avatars' bucket is public.");
            }
        }

        const SETTINGS_ID = settings.id === 'default' ? '00000000-0000-0000-0000-000000000001' : settings.id;

        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                id: SETTINGS_ID,
                org_name: formData.orgName,
                app_description: formData.appDescription,
                logo_url: finalLogoUrl,
                updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id'
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase Error:", error);
            setSaveError({ message: error.message, code: error.code });
            throw error;
        }

        onUpdate({
            id: data.id,
            orgName: data.org_name,
            appDescription: data.app_description,
            logoUrl: data.logo_url
        });

        setSelectedFile(null);
        alert("System branding updated successfully!");
    } catch (err: any) {
        console.error("Sync process failed:", err);
    } finally {
        setIsSaving(false);
        setIsSyncing(false);
    }
  };

  const isCacheError = saveError?.message.includes('schema cache') || saveError?.code === 'PGRST204';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-gray-400">Customize organization branding and application metadata.</p>
        </div>
        {isSyncing && (
            <div className="flex items-center text-blue-400 text-sm font-medium animate-pulse">
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Synchronizing...
            </div>
        )}
      </div>

      {saveError && (
          <div className="bg-red-900/20 border border-red-800/50 p-6 rounded-xl animate-shake">
              <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                      <h4 className="text-red-400 font-bold text-lg">Database Sync Failed</h4>
                      <p className="text-red-300/80 text-sm mt-1">
                          {saveError.message}
                      </p>
                      
                      {isCacheError && (
                        <div className="mt-6 bg-black/60 rounded-xl p-5 border border-red-900/50">
                            <div className="flex items-center text-red-400 font-bold text-xs uppercase tracking-widest mb-3">
                                <Terminal className="w-4 h-4 mr-2" />
                                Required Fix Steps
                            </div>
                            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                                Supabase hasn't updated its API cache yet. To fix this immediately, run this command in your Supabase SQL Editor:
                            </p>
                            <code className="block bg-gray-900 p-3 rounded text-green-400 text-[10px] font-mono whitespace-pre overflow-x-auto border border-gray-700">
                                COMMENT ON TABLE public.system_settings IS 'Refresh Cache';
                            </code>
                            <button 
                                onClick={() => window.location.reload()}
                                className="mt-4 w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 py-2 rounded-lg text-xs font-bold transition-all border border-red-600/30"
                            >
                                Reload App After Running SQL
                            </button>
                        </div>
                      )}
                  </div>
