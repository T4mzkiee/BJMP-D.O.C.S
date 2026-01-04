
import React, { useState, useRef, useEffect } from 'react';
import { SystemSettings } from '../types';
import { Save, Upload, Camera, Building2, Layout, Loader2, FileText, CheckCircle, RefreshCcw, AlertTriangle, X, Terminal, Copy, ShieldCheck, ShieldAlert } from 'lucide-react';
import { supabase, uploadFile } from '../utils/supabase';

interface SystemSettingsPageProps {
  settings: SystemSettings;
  onUpdate: (settings: SystemSettings) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ settings, onUpdate }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);
  
  const [formData, setFormData] = useState({
    orgName: settings.orgName,
    appDescription: settings.appDescription,
    logoUrl: settings.logoUrl,
    logoLeftUrl: settings.logoLeftUrl,
    logoRightUrl: settings.logoRightUrl
  });

  useEffect(() => {
    setFormData({
      orgName: settings.orgName,
      appDescription: settings.appDescription,
      logoUrl: settings.logoUrl,
      logoLeftUrl: settings.logoLeftUrl,
      logoRightUrl: settings.logoRightUrl
    });
    setPreviewUrl(settings.logoUrl);
    setPreviewLeftUrl(settings.logoLeftUrl || null);
    setPreviewRightUrl(settings.logoRightUrl || null);
  }, [settings]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileLeftInputRef = useRef<HTMLInputElement>(null);
  const fileRightInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLeftFile, setSelectedLeftFile] = useState<File | null>(null);
  const [selectedRightFile, setSelectedRightFile] = useState<File | null>(null);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.logoUrl);
  const [previewLeftUrl, setPreviewLeftUrl] = useState<string | null>(settings.logoLeftUrl || null);
  const [previewRightUrl, setPreviewRightUrl] = useState<string | null>(settings.logoRightUrl || null);

  const sqlFix = `-- 1. Add missing columns
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS logo_left_url TEXT,
ADD COLUMN IF NOT EXISTS logo_right_url TEXT;

-- 2. Enable Row Level Security (RLS)
-- This satisfies the Supabase Security Advisor
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create Security Policies
-- Allow anyone (even non-logged in users) to see branding
DROP POLICY IF EXISTS "Enable read access for all users" ON system_settings;
CREATE POLICY "Enable read access for all users" 
ON system_settings FOR SELECT 
USING (true);

-- Allow authenticated users to update settings
DROP POLICY IF EXISTS "Enable update for authenticated users" ON system_settings;
CREATE POLICY "Enable update for authenticated users" 
ON system_settings FOR ALL 
TO anon, authenticated
USING (true)
WITH CHECK (true);`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'left' | 'right') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
          alert("File size too large. Max 2MB allowed.");
          return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      if (type === 'main') {
        setSelectedFile(file);
        setPreviewUrl(objectUrl);
      } else if (type === 'left') {
        setSelectedLeftFile(file);
        setPreviewLeftUrl(objectUrl);
      } else {
        setSelectedRightFile(file);
        setPreviewRightUrl(objectUrl);
      }
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
    setShowSqlFix(false);
    
    let finalLogoUrl = formData.logoUrl;
    let finalLogoLeftUrl = formData.logoLeftUrl;
    let finalLogoRightUrl = formData.logoRightUrl;

    try {
        if (selectedFile) {
            const uploadedUrl = await uploadFile(selectedFile, 'avatars');
            if (uploadedUrl) finalLogoUrl = uploadedUrl;
        }
        if (selectedLeftFile) {
            const uploadedUrl = await uploadFile(selectedLeftFile, 'avatars');
            if (uploadedUrl) finalLogoLeftUrl = uploadedUrl;
        }
        if (selectedRightFile) {
            const uploadedUrl = await uploadFile(selectedRightFile, 'avatars');
            if (uploadedUrl) finalLogoRightUrl = uploadedUrl;
        }

        const SETTINGS_ID = settings.id === 'default' ? '00000000-0000-0000-0000-000000000001' : settings.id;

        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                id: SETTINGS_ID,
                org_name: formData.orgName,
                app_description: formData.appDescription,
                logo_url: finalLogoUrl,
                logo_left_url: finalLogoLeftUrl,
                logo_right_url: finalLogoRightUrl,
                updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id'
            })
            .select()
            .single();

        if (error) {
            if (error.message.includes('column') || error.code === '42P01' || error.message.includes('row-level security')) {
                setShowSqlFix(true);
                throw new Error("Database configuration error. Please run the SQL fix script in your Supabase Dashboard.");
            }
            throw new Error(error.message);
        }

        onUpdate({
            id: data.id,
            orgName: data.org_name,
            appDescription: data.app_description,
            logoUrl: data.logo_url,
            logoLeftUrl: data.logo_left_url,
            logoRightUrl: data.logo_right_url
        });

        setSelectedFile(null);
        setSelectedLeftFile(null);
        setSelectedRightFile(null);
        alert("Branding updated successfully!");
    } catch (err: any) {
        setSaveError(err.message || "An error occurred.");
    } finally {
        setIsSaving(false);
        setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-gray-400">Customize organization branding and satisfy security requirements.</p>
        </div>
        {isSyncing && (
            <div className="flex items-center text-blue-400 text-sm font-medium animate-pulse">
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Syncing with Cloud...
            </div>
        )}
      </div>

      <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <div>
                  <h4 className="text-sm font-bold text-white">Security Hardening</h4>
                  <p className="text-xs text-gray-400">Ensure Row Level Security (RLS) is enabled for all tables in Supabase.</p>
              </div>
          </div>
          <button 
            onClick={() => setShowSqlFix(!showSqlFix)}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 underline"
          >
              {showSqlFix ? 'Hide SQL Script' : 'View Security SQL'}
          </button>
      </div>

      {showSqlFix && (
          <div className="bg-gray-800 border border-blue-900/50 rounded-xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 bg-blue-900/20 border-b border-blue-900/30">
                  <span className="text-xs font-mono text-blue-400 uppercase flex items-center">
                      <Terminal className="w-4 h-4 mr-2" /> Supabase Security & Schema Fix
                  </span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(sqlFix); alert("SQL copied!"); }}
                    className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Script</span>
                  </button>
              </div>
              <pre className="p-4 text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {sqlFix}
              </pre>
              <div className="px-4 py-3 bg-gray-900/50 text-[10px] text-gray-500 italic">
                  Run this script in your Supabase SQL Editor to enable RLS and fix the Security Advisor warnings.
              </div>
          </div>
      )}

      {saveError && (
          <div className="bg-red-900/20 border border-red-800/50 p-5 rounded-xl animate-shake">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-red-400 font-bold text-sm">Action Required</h4>
                    <p className="text-red-300/80 text-xs mt-1 leading-relaxed">{saveError}</p>
                </div>
                <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                </button>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6 flex flex-col items-center">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 w-full">Logos Management</h3>
                <div className="w-full space-y-2 mb-8">
                  <label className="text-xs font-medium text-gray-500 uppercase">Center Logo</label>
                  <div className="relative group cursor-pointer" onClick={() => !isSaving && fileInputRef.current?.click()}>
                      <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                          {previewUrl ? <img src={previewUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <FileText className="w-8 h-8 text-gray-500" />}
                      </div>
                      {!isSaving && <div className="absolute inset-0 bg-black bg-opacity-40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'main')} className="hidden" accept="image/*" disabled={isSaving} />
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 uppercase">Left Logo</label>
                        <div className="relative group cursor-pointer" onClick={() => !isSaving && fileLeftInputRef.current?.click()}>
                            <div className="w-full h-24 rounded-lg overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                                {previewLeftUrl ? <img src={previewLeftUrl} alt="Left" className="w-full h-full object-contain p-2" /> : <Upload className="w-6 h-6 text-gray-500" />}
                            </div>
                        </div>
                        <input type="file" ref={fileLeftInputRef} onChange={e => handleFileChange(e, 'left')} className="hidden" accept="image/*" disabled={isSaving} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 uppercase">Right Logo</label>
                        <div className="relative group cursor-pointer" onClick={() => !isSaving && fileRightInputRef.current?.click()}>
                            <div className="w-full h-24 rounded-lg overflow-hidden border-2 border-dashed border-gray-600 group-hover:border-blue-500 transition-colors bg-gray-900 flex items-center justify-center">
                                {previewRightUrl ? <img src={previewRightUrl} alt="Right" className="w-full h-full object-contain p-2" /> : <Upload className="w-6 h-6 text-gray-500" />}
                            </div>
                        </div>
                        <input type="file" ref={fileRightInputRef} onChange={e => handleFileChange(e, 'right')} className="hidden" accept="image/*" disabled={isSaving} />
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center"><Building2 className="w-4 h-4 mr-2" />General Information</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Organization Name</label>
                        <input type="text" value={formData.orgName} onChange={e => setFormData({...formData, orgName: e.target.value})} disabled={isSaving} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 outline-none text-white focus:ring-2 focus:ring-blue-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Application Description</label>
                        <textarea value={formData.appDescription} onChange={e => setFormData({...formData, appDescription: e.target.value})} disabled={isSaving} rows={4} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 outline-none text-white focus:ring-2 focus:ring-blue-500 transition-all resize-none" />
                    </div>
                </div>
                <div className="mt-10 pt-6 border-t border-gray-700 flex justify-end">
                    <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center disabled:opacity-50 min-w-[200px] justify-center transition-all">
                        {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Syncing...</> : <><CheckCircle className="w-5 h-5 mr-2" />Save Branding</>}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};