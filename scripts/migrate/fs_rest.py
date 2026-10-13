"""Firestore REST 도우미(이전 스크립트용) — 서비스 계정으로 읽기·쓰기. 문서는 가능한 한 원본 값(Value) 그대로 복사해 시각·숫자 형식이 바뀌지 않게 한다."""
import json, requests, time
from google.oauth2 import service_account
import google.auth.transport.requests as gt
class FS:
    def __init__(self, key_path, dry=False):
        self.info = json.load(open(key_path)); self.pid = self.info['project_id']; self.dry = dry; self.cred = None; self.base = f'https://firestore.googleapis.com/v1/projects/{self.pid}/databases/(default)/documents'; self.writes = 0
    def _h(self):
        if not self.cred or not self.cred.valid:
            self.cred = service_account.Credentials.from_service_account_info(self.info, scopes=['https://www.googleapis.com/auth/datastore']); self.cred.refresh(gt.Request())
        return {'Authorization': 'Bearer ' + self.cred.token}
    def collection_ids(self, parent=''):
        out = []; tok = None
        while True:
            r = requests.post(f'{self.base}/{parent}:listCollectionIds' if parent else f'{self.base}:listCollectionIds', headers=self._h(), json={'pageSize': 300, **({'pageToken': tok} if tok else {})}); r.raise_for_status(); j = r.json(); out += j.get('collectionIds', []); tok = j.get('nextPageToken')
            if not tok: return out
    def list(self, path):
        """컬렉션의 모든 문서 → [(id, fields(원본 Value 맵))]"""
        out = []; tok = None
        while True:
            r = requests.get(f'{self.base}/{path}', headers=self._h(), params={'pageSize': 300, **({'pageToken': tok} if tok else {})})
            if r.status_code == 404: return out
            r.raise_for_status(); j = r.json()
            for d in j.get('documents', []): out.append((d['name'].split('/')[-1], d.get('fields', {})))
            tok = j.get('nextPageToken')
            if not tok: return out
    def get(self, path):
        r = requests.get(f'{self.base}/{path}', headers=self._h())
        if r.status_code == 404: return None
        r.raise_for_status(); return r.json().get('fields', {})
    def commit(self, writes):
        """writes: [{'path': 'a/b', 'fields': {...}}] 전체 쓰기(문서가 있으면 덮어씀). 500개씩"""
        for i in range(0, len(writes), 400):
            part = writes[i:i + 400]; self.writes += len(part)
            if self.dry: continue
            body = {'writes': [{'update': {'name': f"projects/{self.pid}/databases/(default)/documents/{w['path']}", 'fields': w['fields']}} for w in part]}
            for k in range(4):
                r = requests.post(f'{self.base}:commit', headers=self._h(), json=body)
                if r.status_code == 200: break
                time.sleep(1 + k)
            else: raise RuntimeError('commit 실패 ' + r.text[:300])
# 값 변환(새로 만드는 문서용)
def enc(v):
    if v is None: return {'nullValue': None}
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, list): return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
    raise TypeError(type(v))
def dec(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'nullValue' in v: return None
    if 'timestampValue' in v: return v['timestampValue']
    if 'arrayValue' in v: return [dec(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v: return {k: dec(x) for k, x in v['mapValue'].get('fields', {}).items()}
    return None
def encf(d): return {k: enc(v) for k, v in d.items()}
def decf(f): return {k: dec(v) for k, v in (f or {}).items()}
